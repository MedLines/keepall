import { Blob as NodeBlob } from "node:buffer";
import { expect, test, vi } from "vitest";
import { BlobReader, TextReader, TextWriter, Uint8ArrayWriter, ZipReader, ZipWriter } from "@zip.js/zip.js";
import { createDocument, getDocumentOriginal, updateDocument } from "./documents";
import { getDb, deleteKeepallDatabase } from "./db";
import { exportKeepallArchive, importKeepallArchiveReplace, importKeepallArchiveMerge, validateKeepallArchive, readAutomaticBackupMetadata } from "./backup-archive";
import { exportKeepallBackup, countCurrentLibrary } from "./backup";
import { buildNote } from "@/domain/note";
import { pdfFixture } from "../../test-support/pdf-fixture";

const bytes = new TextEncoder().encode("\uFEFF# Exact original\r\nمرحبا café\n");
async function readable(blob: Blob) { return new NodeBlob([new Uint8Array(await blob.arrayBuffer())]) as unknown as Blob; }

test("PDF ZIP replace and merge preserve exact files and rebuild searchable text", async () => {
  const bytes = pdfFixture(["First page", "Searchable unicorn café"]);
  const item = await createDocument({ fileName: "reference.pdf", bytes, noteContent: "My note" });
  const archive = await readable(await exportKeepallArchive());
  await deleteKeepallDatabase();
  await importKeepallArchiveReplace(archive);
  expect(await getDb().items.get(item.id)).toMatchObject({ format: "pdf", noteContent: "My note" });
  const restored = (await getDocumentOriginal(item.id))!;
  expect(Array.from(restored.bytes)).toEqual(Array.from(bytes));
  expect(restored.pdfText).toContain("Searchable unicorn café");
  await deleteKeepallDatabase();
  await importKeepallArchiveMerge(archive);
  expect(Array.from((await getDocumentOriginal(item.id))!.bytes)).toEqual(Array.from(bytes));
});

async function modifiedArchive(original: Blob, change: (manifest: Record<string, unknown>, entries: Map<string, Uint8Array>) => void) {
  const reader = new ZipReader(new BlobReader(await readable(original)));
  const entries = await reader.getEntries();
  const manifestEntry = entries.find((entry) => entry.filename === "manifest.json")!;
  if (manifestEntry.directory) throw new Error("Manifest cannot be a directory");
  const manifest = JSON.parse(await manifestEntry.getData(new TextWriter())) as Record<string, unknown>;
  const files = new Map<string, Uint8Array>();
  for (const entry of entries) if (entry !== manifestEntry && !entry.directory) files.set(entry.filename, await entry.getData(new Uint8ArrayWriter()));
  await reader.close();
  change(manifest, files);
  const writer = new ZipWriter(new Uint8ArrayWriter());
  await writer.add("manifest.json", new TextReader(JSON.stringify(manifest)));
  for (const [path, data] of files) await writer.add(path, new BlobReader(new NodeBlob([data]) as unknown as Blob));
  return new NodeBlob([new Uint8Array(await writer.close())]) as unknown as Blob;
}

test("ZIP replacement round-trips documents, exact originals, personal notes, organization and Trash", async () => {
  const db = getDb();
  await db.tags.add({ id: "tag", name: "Reference", createdAt: 1 });
  await db.collections.add({ id: "collection", name: "Reading", createdAt: 1, pinnedItemIds: [] });
  const document = await createDocument({ fileName: "source.md", bytes, noteContent: "My personal note", tagIds: ["tag"], collectionIds: ["collection"] });
  await db.items.update(document.id, { deletedAt: 2 });
  const archive = await readable(await exportKeepallArchive());
  await deleteKeepallDatabase();
  const restored = await importKeepallArchiveReplace(archive);
  expect(restored.items).toContainEqual({ ...document, deletedAt: 2 });
  expect((await getDocumentOriginal(document.id))?.bytes).toEqual(bytes);
  expect(await countCurrentLibrary()).toMatchObject({ documents: 1, documentAssets: 1, trash: 1 });
  await expect(exportKeepallBackup()).rejects.toThrow(/ZIP/);
});

test("merge reuses original bytes and keeps newer personal notes and organization", async () => {
  const original = await createDocument({ fileName: "source.md", bytes });
  const archive = await readable(await exportKeepallArchive());
  await getDb().tags.add({ id: "local-tag", name: "Local", createdAt: 1 });
  await getDb().items.update(original.id, { tagIds: ["local-tag"], updatedAt: Date.now() + 10_000 });
  await updateDocument(original.id, { title: "Local title", noteContent: "Local note" });
  await getDb().items.update(original.id, { updatedAt: Date.now() + 10_000 });
  await importKeepallArchiveMerge(archive);
  expect(await getDb().items.get(original.id)).toMatchObject({ title: "Local title", noteContent: "Local note", tagIds: ["local-tag"] });
  expect(await getDb().documentAssets.count()).toBe(1);
  const second = await createDocument({ fileName: "second.txt", bytes });
  const next = await readable(await exportKeepallArchive());
  await deleteKeepallDatabase();
  await importKeepallArchiveMerge(next);
  expect((await getDocumentOriginal(second.id))?.bytes).toEqual(bytes);
  expect(await getDb().documentAssets.count()).toBe(1);
});

test.each(["missing", "corrupt", "future", "wrong format"])("invalid %s document archives fail before replacement changes any data", async (failure) => {
  await createDocument({ fileName: "source.md", bytes });
  const original = await exportKeepallArchive();
  const broken = await modifiedArchive(original, (manifest, files) => {
    const records = manifest.documents as { path: string }[];
    if (failure === "missing") files.delete(records[0].path);
    if (failure === "corrupt") files.set(records[0].path, new TextEncoder().encode("Different bytes"));
    if (failure === "future") manifest.version = 999;
    if (failure === "wrong format") (manifest.items as { format: string }[])[0].format = "html";
  });
  const sentinel = buildNote({ content: "Keep my current library" });
  await getDb().items.add(sentinel);
  await expect(importKeepallArchiveReplace(broken)).rejects.toThrow();
  expect(await getDb().items.get(sentinel.id)).toEqual(sentinel);
});

test("replacement quota errors roll back document originals and existing library data", async () => {
  const item = await createDocument({ fileName: "source.md", bytes });
  const archive = await readable(await exportKeepallArchive());
  const sentinel = buildNote({ content: "Current" });
  await getDb().items.add(sentinel);
  vi.spyOn(getDb().documentAssets, "bulkAdd").mockRejectedValueOnce(new DOMException("Quota", "QuotaExceededError"));
  await expect(importKeepallArchiveReplace(archive)).rejects.toThrow("Quota");
  expect(await getDb().items.get(sentinel.id)).toEqual(sentinel);
  expect((await getDocumentOriginal(item.id))?.bytes).toEqual(bytes);
});

test("export refuses a document with a missing original instead of emitting a broken recovery copy", async () => {
  const item = await createDocument({ fileName: "source.md", bytes });
  await getDb().documentAssets.delete(item.assetId);
  await expect(exportKeepallArchive()).rejects.toThrow(/original/i);
});

test.each([6, 8])("version %s ZIP archives remain readable after documents are introduced", async (version) => {
  const note = buildNote({ content: "From an older library" });
  await getDb().items.add(note);
  const identity = { libraryId: crypto.randomUUID(), snapshotId: crypto.randomUUID() };
  const archive = await modifiedArchive(await exportKeepallArchive(123, identity), (manifest) => {
    manifest.version = version;
    delete manifest.documents;
  });
  await deleteKeepallDatabase();
  await importKeepallArchiveReplace(archive);
  expect(await getDb().items.get(note.id)).toEqual(note);
  expect(await getDb().documentAssets.count()).toBe(0);
  if (version === 8) expect(await readAutomaticBackupMetadata(archive)).toEqual({ exportedAt: 123, automaticBackup: identity });
});

test("empty text originals round-trip without losing their document record", async () => {
  const document = await createDocument({ fileName: "empty.txt", bytes: new Uint8Array() });
  const archive = await readable(await exportKeepallArchive());
  await deleteKeepallDatabase();
  await importKeepallArchiveReplace(archive);
  expect((await getDocumentOriginal(document.id))?.byteLength).toBe(0);
  expect(Array.from((await getDocumentOriginal(document.id))!.bytes)).toEqual([]);
  expect(await countCurrentLibrary()).toMatchObject({ documents: 1, documentAssets: 1 });
});

test("file edits advance the backup revision and restore their updated text", async () => {
  const item = await createDocument({ fileName: "edited.md", bytes });
  const revision = (await getDb().backupState.get("library"))?.revision;
  await updateDocument(item.id, { title: item.title, noteContent: "Personal note", content: "# Updated file\nمرحبا" });
  expect((await getDb().backupState.get("library"))?.revision).not.toBe(revision);
  const archive = await readable(await exportKeepallArchive());
  await deleteKeepallDatabase();
  await importKeepallArchiveReplace(archive);
  expect(new TextDecoder().decode((await getDocumentOriginal(item.id))?.bytes)).toBe("# Updated file\nمرحبا");
  expect(await getDb().items.get(item.id)).toMatchObject({ noteContent: "Personal note" });
});

test("document integrity validation detects changed bytes even when the file size matches", async () => {
  await createDocument({ fileName: "source.md", bytes });
  const archive = await modifiedArchive(await exportKeepallArchive(), (manifest, files) => {
    const [{ path }] = manifest.documents as { path: string }[];
    const altered = new Uint8Array(files.get(path)!);
    altered[altered.length - 1] = 65;
    files.set(path, altered);
  });
  await expect(validateKeepallArchive(archive)).rejects.toThrow(/damaged/);
});

test("a failed document merge rolls back all document records and originals in that batch", async () => {
  await createDocument({ fileName: "first.txt", bytes });
  await createDocument({ fileName: "second.txt", bytes: new TextEncoder().encode("Other original") });
  const archive = await readable(await exportKeepallArchive());
  await deleteKeepallDatabase();
  const local = await createDocument({ fileName: "local.txt", bytes: new TextEncoder().encode("Keep this") });
  const put = getDb().items.put.bind(getDb().items);
  vi.spyOn(getDb().items, "put").mockImplementationOnce(put).mockRejectedValueOnce(new DOMException("Quota", "QuotaExceededError"));
  await expect(importKeepallArchiveMerge(archive)).rejects.toThrow("Quota");
  expect(await getDb().items.toArray()).toEqual([local]);
  expect(await getDb().documentAssets.count()).toBe(1);
  expect((await getDocumentOriginal(local.id))?.bytes).toEqual(new TextEncoder().encode("Keep this"));
});

test("a newer document merge preserves an original still shared by another document", async () => {
  const first = await createDocument({ fileName: "first.md", bytes });
  const shared = await createDocument({ fileName: "shared.txt", bytes });
  const replacement = await createDocument({ fileName: "replacement.txt", bytes: new TextEncoder().encode("Updated original") });
  const archive = await modifiedArchive(await exportKeepallArchive(), (manifest) => {
    const item = (manifest.items as typeof first[]).find((item) => item.id === first.id)!;
    item.assetId = replacement.assetId;
    item.updatedAt += 10_000;
    item.noteContent = "New personal note";
  });
  await importKeepallArchiveMerge(archive);
  expect((await getDocumentOriginal(first.id))?.bytes).toEqual(new TextEncoder().encode("Updated original"));
  expect((await getDocumentOriginal(shared.id))?.bytes).toEqual(bytes);
  expect(await getDb().items.get(first.id)).toMatchObject({ noteContent: "New personal note" });
  expect(await getDb().documentAssets.count()).toBe(2);
});
