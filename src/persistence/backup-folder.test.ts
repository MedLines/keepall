import { Blob as NodeBlob } from "node:buffer";
import { TextReader, Uint8ArrayWriter, ZipWriter } from "@zip.js/zip.js";
import { expect, test } from "vitest";
import { buildNote } from "@/domain/note";
import { getDb } from "./db";
import { exportKeepallArchive, importKeepallArchiveReplace } from "./backup-archive";
import {
  pruneAutomaticBackups,
  writeAutomaticBackup,
  type BackupDirectory,
  type CompletedAutomaticBackup,
} from "./backup-folder";

const libraryId = "11111111-1111-4111-8111-111111111111";
const otherLibraryId = "22222222-2222-4222-8222-222222222222";

async function readableBlob(blob: Blob): Promise<Blob> {
  const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
  return new NodeBlob([bytes], { type: blob.type }) as unknown as Blob;
}

function folder() {
  const files = new Map<string, Blob>();
  let permission: PermissionState = "granted";
  let failure: "write" | "close" | "read" | "corrupt" | "marker" | "remove" | "permission" | null = null;
  let onWrite: (() => void) | undefined;
  const aborted: string[] = [];
  const directory: BackupDirectory = {
    async queryPermission() { return permission; },
    async getFileHandle(name, options) {
      if (!files.has(name)) {
        if (!options?.create) throw new DOMException("Missing file", "NotFoundError");
        files.set(name, new NodeBlob([]) as unknown as Blob);
      }
      return {
        async getFile() {
          if (failure === "read") throw new DOMException("Cannot read", "NotReadableError");
          return files.get(name)!;
        },
        async createWritable() {
          let pending: Blob | undefined;
          return {
            async write(data) {
              onWrite?.();
              if (failure === "permission") throw new DOMException("Permission lost", "NotAllowedError");
              if (failure === "write" || (failure === "marker" && name.endsWith(".complete.json"))) {
                throw new DOMException("Disk full", "QuotaExceededError");
              }
              if (typeof data === "string") pending = new NodeBlob([data]) as unknown as Blob;
              else if (data instanceof NodeBlob) pending = data as unknown as Blob;
              else throw new Error("Expected readable Blob or string");
            },
            async close() {
              if (failure === "close") throw new DOMException("Disk full", "QuotaExceededError");
              if (!pending) throw new Error("Nothing was written");
              if (failure === "corrupt") {
                const bytes = new Uint8Array(await pending.arrayBuffer());
                bytes[bytes.length - 1] ^= 1;
                pending = new NodeBlob([bytes]) as unknown as Blob;
              }
              files.set(name, pending);
            },
            async abort() { aborted.push(name); },
          };
        },
      };
    },
    async removeEntry(name) {
      if (failure === "remove") throw new DOMException("Permission lost", "NotAllowedError");
      if (!files.delete(name)) throw new DOMException("Missing file", "NotFoundError");
    },
  };
  return {
    directory, files, aborted,
    setPermission(value: PermissionState) { permission = value; },
    fail(value: typeof failure) { failure = value; },
    onWrite(callback: () => void) { onWrite = callback; },
  };
}

async function archive(exportedAt = 123, id = libraryId) {
  const identity = { libraryId: id, snapshotId: crypto.randomUUID() };
  const blob = await readableBlob(await exportKeepallArchive(exportedAt, identity));
  return { blob, identity };
}

test("writes a restorable ZIP and a completion record without changing the live library", async () => {
  const note = buildNote({ content: "Keep this original" });
  await getDb().items.put(note);
  const destination = folder();
  const { blob, identity } = await archive();
  const replacement = buildNote({ content: "Edited while writing" });
  await getDb().items.put(replacement);

  const result = await writeAutomaticBackup(destination.directory, blob, identity);

  expect(result).toMatchObject({ ...identity, exportedAt: 123, byteLength: blob.size });
  const current = await getDb().items.toArray();
  expect(current).toHaveLength(2);
  expect(current).toEqual(expect.arrayContaining([note, replacement]));
  const marker = destination.files.get(`${result.fileName}.complete.json`)!;
  expect(JSON.parse(await marker.text())).toMatchObject({ format: "keepall-automatic-backup", version: 1, ...result });
  await getDb().items.clear();
  await importKeepallArchiveReplace(destination.files.get(result.fileName)!);
  expect(await getDb().items.toArray()).toEqual([note]);
});

test.each(["prompt", "denied"] as const)("permission %s requires reconnect without creating a file", async (permission) => {
  const destination = folder();
  destination.setPermission(permission);
  const { blob, identity } = await archive();
  await expect(writeAutomaticBackup(destination.directory, blob, identity))
    .rejects.toMatchObject({ code: "permission-required" });
  expect(destination.files.size).toBe(0);
});

test.each(["write", "close", "read", "corrupt", "marker"] as const)("%s failure preserves completed backups and does not report success", async (failure) => {
  const destination = folder();
  const first = await archive();
  const completed = await writeAutomaticBackup(destination.directory, first.blob, first.identity);
  const previous = destination.files.get(completed.fileName);
  const next = await archive(456);
  destination.fail(failure);

  await expect(writeAutomaticBackup(destination.directory, next.blob, next.identity)).rejects.toThrow();
  expect(destination.files.get(completed.fileName)).toBe(previous);
  expect(JSON.parse(await destination.files.get(`${completed.fileName}.complete.json`)!.text())).toMatchObject(completed);
  expect([...destination.files.values()].filter((file) => file.size > 0).length).toBeGreaterThanOrEqual(2);
  if (failure === "write" || failure === "close" || failure === "marker") expect(destination.aborted).toHaveLength(1);
});

test("aborting an in-flight write leaves no completion record", async () => {
  const destination = folder();
  const controller = new AbortController();
  destination.onWrite(() => controller.abort());
  const { blob, identity } = await archive();

  await expect(writeAutomaticBackup(destination.directory, blob, identity, controller.signal)).rejects.toThrow();
  expect(destination.aborted).toHaveLength(1);
  expect([...destination.files.keys()].some((name) => name.endsWith(".complete.json"))).toBe(false);
});

test("permission lost during writing reports that the folder needs reconnecting", async () => {
  const destination = folder();
  const { blob, identity } = await archive();
  destination.fail("permission");
  await expect(writeAutomaticBackup(destination.directory, blob, identity))
    .rejects.toMatchObject({ code: "permission-required" });
  expect([...destination.files.keys()].some((name) => name.endsWith(".complete.json"))).toBe(false);
});

test("a colliding filename is preserved", async () => {
  const destination = folder();
  const { blob, identity } = await archive();
  const completed = await writeAutomaticBackup(destination.directory, blob, identity);
  const previous = new Map(destination.files);
  await expect(writeAutomaticBackup(destination.directory, blob, identity)).rejects.toMatchObject({ code: "file-exists" });
  expect(destination.files).toEqual(previous);
  expect(destination.files.get(completed.fileName)).toBe(blob);
});

test("a wrong library identity or invalid ZIP cannot create a completed backup", async () => {
  const destination = folder();
  const { blob, identity } = await archive();
  await expect(writeAutomaticBackup(destination.directory, blob, { ...identity, libraryId: otherLibraryId }))
    .rejects.toMatchObject({ code: "verification-failed" });
  await expect(writeAutomaticBackup(destination.directory, new NodeBlob(["Not a ZIP"]) as unknown as Blob, identity))
    .rejects.toMatchObject({ code: "verification-failed" });
  expect([...destination.files.keys()].some((name) => name.endsWith(".complete.json"))).toBe(false);
});

test("an archive with valid ownership metadata but invalid library contents never gets a completion record", async () => {
  const destination = folder();
  const identity = { libraryId, snapshotId: crypto.randomUUID() };
  const writer = new ZipWriter(new Uint8ArrayWriter());
  await writer.add("manifest.json", new TextReader(JSON.stringify({
    format: "keepall", version: 8, exportedAt: 123, automaticBackup: identity,
    items: [{ type: "unknown" }], tags: [], collections: [], assets: [], videos: [], thumbnails: [],
    preferences: { pinnedCollectionIds: [] },
  })));
  const invalid = new NodeBlob([new Uint8Array(await writer.close())]) as unknown as Blob;
  await expect(writeAutomaticBackup(destination.directory, invalid, identity))
    .rejects.toMatchObject({ code: "verification-failed" });
  expect(destination.files.size).toBe(1);
  expect([...destination.files.keys()].some((name) => name.endsWith(".complete.json"))).toBe(false);
});

async function completedBackups(destination: ReturnType<typeof folder>) {
  const backups: CompletedAutomaticBackup[] = [];
  for (let exportedAt = 1; exportedAt <= 5; exportedAt += 1) {
    const { blob, identity } = await archive(exportedAt);
    backups.push(await writeAutomaticBackup(destination.directory, blob, identity));
  }
  return backups;
}

test("retains the newest three and protects unrelated, manual, incomplete, and other-library files", async () => {
  const destination = folder();
  const backups = await completedBackups(destination);
  const other = await archive(99, otherLibraryId);
  const otherBackup = await writeAutomaticBackup(destination.directory, other.blob, other.identity);
  const incomplete = await archive(100);
  destination.fail("write");
  await expect(writeAutomaticBackup(destination.directory, incomplete.blob, incomplete.identity)).rejects.toThrow();
  destination.fail(null);
  destination.files.set("manual.keepall.zip", await readableBlob(await exportKeepallArchive()));
  destination.files.set("family.txt", new NodeBlob(["Personal file"]) as unknown as Blob);
  const before = new Map(destination.files);

  const result = await pruneAutomaticBackups(destination.directory, libraryId, [...backups, otherBackup]);

  expect(result.cleanupError).toBeNull();
  expect(result.backups.map((backup) => backup.fileName).sort())
    .toEqual([...backups.slice(2), otherBackup].map((backup) => backup.fileName).sort());
  for (const [name, value] of before) {
    const removed = backups.slice(0, 2).some((backup) => name === backup.fileName || name === `${backup.fileName}.complete.json`);
    if (removed) expect(destination.files.has(name)).toBe(false);
    else expect(destination.files.get(name)).toBe(value);
  }
});

test.each(["missing marker", "changed marker", "changed archive", "unsafe name", "unverified newest"] as const)("retention refuses %s without deleting files", async (failure) => {
  const destination = folder();
  const backups = await completedBackups(destination);
  const oldest = backups[0];
  if (failure === "missing marker") destination.files.delete(`${oldest.fileName}.complete.json`);
  if (failure === "changed marker") destination.files.set(`${oldest.fileName}.complete.json`, new NodeBlob(["{}"]) as unknown as Blob);
  if (failure === "changed archive") {
    const manual = await readableBlob(await exportKeepallArchive());
    const padding = new Uint8Array(oldest.byteLength - manual.size);
    destination.files.set(oldest.fileName, new NodeBlob([manual as unknown as NodeBlob, padding]) as unknown as Blob);
  }
  if (failure === "unsafe name") backups[0] = { ...oldest, fileName: "family.txt" };
  if (failure === "unverified newest") destination.files.delete(`${backups[4].fileName}.complete.json`);
  const before = new Map(destination.files);

  const result = await pruneAutomaticBackups(destination.directory, libraryId, backups);

  expect(result.cleanupError).toBeTruthy();
  expect(destination.files).toEqual(before);
  expect(result.backups).toEqual(backups);
});

test("cleanup failure preserves the new completed backup and reports a separate warning", async () => {
  const destination = folder();
  const backups = await completedBackups(destination);
  const before = new Map(destination.files);
  destination.fail("remove");
  const result = await pruneAutomaticBackups(destination.directory, libraryId, backups);
  expect(result.cleanupError).toBeTruthy();
  expect(result.backups).toEqual(backups);
  expect(destination.files).toEqual(before);
});

test("duplicate history records cannot cause a retained backup to be removed", async () => {
  const destination = folder();
  const backups = (await completedBackups(destination)).slice(2);
  const before = new Map(destination.files);
  const result = await pruneAutomaticBackups(destination.directory, libraryId, [...backups, backups[2]]);
  expect(result.cleanupError).toBeTruthy();
  expect(destination.files).toEqual(before);
});
