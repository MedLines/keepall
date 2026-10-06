import { expect, test } from "vitest";
import { buildNote } from "@/domain/note";
import { getDb } from "./db";
import { readBackupSnapshot } from "./backup-snapshot";

async function revision() { return (await getDb().backupState.get("library"))?.revision; }

test("document revisions change only with committed original writes, including mixed transactions", async () => {
  const db = getDb();
  const original = { id: "original", bytes: new TextEncoder().encode("Original"), byteLength: 8, contentHash: "original", createdAt: 1 };
  await db.documentAssets.put(original);
  const before = (await db.backupState.get("documents"))?.revision;
  expect(before).toEqual(expect.any(String));
  await db.items.add(buildNote({ content: "Unrelated" }));
  await db.tags.put({ id: "tag", name: "Other", createdAt: 1 });
  expect((await db.backupState.get("documents"))?.revision).toBe(before);
  await db.transaction("rw", db.items, db.documentAssets, async () => {
    await Promise.all([
      db.documentAssets.put({ ...original, bytes: new TextEncoder().encode("Replaced"), contentHash: "replaced" }),
      db.items.add(buildNote({ content: "Same transaction" })),
    ]);
  });
  const replaced = (await db.backupState.get("documents"))?.revision;
  expect(replaced).not.toBe(before);
  await expect(db.transaction("rw", db.documentAssets, async () => {
    await db.documentAssets.delete(original.id);
    throw new Error("Rollback");
  })).rejects.toThrow("Rollback");
  expect((await db.backupState.get("documents"))?.revision).toBe(replaced);
  await db.documentAssets.clear();
  expect((await db.backupState.get("documents"))?.revision).not.toBe(replaced);
});

test("tracks committed adds, edits, bulk writes and clearing with the library transaction", async () => {
  const db = getDb();
  const note = buildNote({ content: "First" });
  await db.items.add(note);
  const first = await revision();
  expect(first).toEqual(expect.any(String));
  await db.items.update(note.id, { title: "Changed" });
  expect(await revision()).not.toBe(first);
  const second = await revision();
  await db.transaction("rw", db.items, db.tags, async () => {
    await db.items.bulkPut([note]);
    await db.tags.put({ id: "tag", name: "Tag", createdAt: 1 });
  });
  expect(await revision()).not.toBe(second);
  const third = await revision();
  await db.items.clear();
  expect(await revision()).not.toBe(third);
});

test("rolled-back writes cannot advance the durable revision", async () => {
  const db = getDb();
  const note = buildNote({ content: "Original" });
  await db.items.add(note);
  const before = await revision();
  await expect(db.transaction("rw", db.items, async () => {
    await db.items.update(note.id, { title: "Rolled back" });
    throw new Error("Rollback");
  })).rejects.toThrow("Rollback");
  expect(await revision()).toBe(before);
  expect((await db.items.get(note.id))?.title).toBe(note.title);
});

test("every exported table advances revision, while backup configuration does not", async () => {
  const db = getDb();
  for (const table of [db.items, db.tags, db.collections, db.assets, db.videoAssets, db.thumbnails, db.preferences, db.documentAssets]) {
    const before = await revision();
    await table.clear();
    expect(await revision()).not.toBe(before);
  }
  const before = await revision();
  await db.backupSettings.clear();
  expect(await revision()).toBe(before);
});

test("snapshots capture their revision with their content, and reads never dirty the library", async () => {
  const db = getDb();
  await db.items.add(buildNote({ content: "Snapshot" }));
  const before = await revision();
  const snapshot = await readBackupSnapshot();
  expect(snapshot.revision).toBe(before);
  expect(snapshot.items).toHaveLength(1);
  expect(await revision()).toBe(before);
});

test("failed adds leave revision unchanged and replace restores advance it", async () => {
  const { exportKeepallBackup, importKeepallBackupReplace } = await import("./backup");
  const db = getDb();
  const note = buildNote({ content: "Keep" });
  await db.items.add(note);
  const before = await revision();
  await expect(db.items.add(note)).rejects.toThrow();
  expect(await revision()).toBe(before);
  const backup = await exportKeepallBackup();
  expect(JSON.stringify(backup)).not.toContain(before);
  await importKeepallBackupReplace(backup);
  expect(await revision()).not.toBe(before);
  expect(await db.items.get(note.id)).toEqual(note);
});

test("extension captures and their edits advance the durable revision", async () => {
  const { saveExtensionLink } = await import("./extension-capture");
  const before = await revision();
  await saveExtensionLink({ captureId: crypto.randomUUID(), url: "https://example.com", title: "From extension" });
  const added = await revision();
  expect(added).not.toBe(before);
  await saveExtensionLink({ captureId: crypto.randomUUID(), url: "https://example.com", title: "From extension", noteContent: "New note" });
  expect(await revision()).not.toBe(added);
});
