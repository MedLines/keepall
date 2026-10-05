import { expect, test, vi } from "vitest";
import Dexie from "dexie";
import { buildNote } from "@/domain/note";
import { createTextDocument, getDocumentOriginal, updateDocument } from "./documents";
import { getDb } from "./db";
import { deleteItem, restoreItem, permanentlyDeleteItem, emptyTrash } from "./items";

const bytes = new TextEncoder().encode("\uFEFF# Original\r\nUnicode مرحبا\n");

test("upgrading version 10 preserves saves, preferences and the automatic backup connection", async () => {
  const previous = new Dexie("keepall");
  previous.version(10).stores({
    items: "id, type, createdAt", tags: "id, name", collections: "id, name", assets: "id, contentHash",
    preferences: "id", thumbnails: "assetId", videoAssets: "id", backupSettings: "id", backupState: "id",
  });
  const note = buildNote({ content: "Saved before documents" });
  const preferences = { id: "library", pinnedCollectionIds: [] };
  const settings = { id: "folder", enabled: true, directory: { kind: "directory", name: "Backups" }, completed: [] };
  const revision = { id: "library", revision: "existing-revision" };
  await previous.table("items").put(note);
  await previous.table("preferences").put(preferences);
  await previous.table("backupSettings").put(settings);
  await previous.table("backupState").put(revision);
  previous.close();

  expect(await getDb().items.get(note.id)).toEqual(note);
  expect(await getDb().preferences.get("library")).toEqual(preferences);
  expect(await getDb().backupSettings.get("folder")).toEqual(settings);
  expect(await getDb().backupState.get("library")).toEqual(revision);
  expect(await getDb().documentAssets.count()).toBe(0);
});

test("stores exact original bytes separately from the lightweight document item", async () => {
  const item = await createTextDocument({ fileName: "reference.md", bytes });
  expect(item).toMatchObject({ type: "document", format: "markdown", sourceFileName: "reference.md", title: "reference", noteContent: "" });
  expect(item).not.toHaveProperty("bytes");
  expect(item).not.toHaveProperty("content");
  expect((await getDocumentOriginal(item.id))?.bytes).toEqual(bytes);
  expect((await getDb().backupState.get("library"))?.revision).toEqual(expect.any(String));
});

test("deduplicates original bytes across filenames without sharing personal notes", async () => {
  const first = await createTextDocument({ fileName: "first.txt", bytes, noteContent: "My note" });
  const second = await createTextDocument({ fileName: "second.md", bytes });
  expect(first.assetId).toBe(second.assetId);
  expect(first.id).not.toBe(second.id);
  expect(await getDb().documentAssets.count()).toBe(1);
  await updateDocument(first.id, { title: "New title", noteContent: "Changed note" });
  expect((await getDocumentOriginal(first.id))?.bytes).toEqual(bytes);
  expect((await getDb().items.get(second.id))?.title).toBe("second");
});

test("quota failure rolls back the item, original and revision", async () => {
  vi.spyOn(getDb().items, "add").mockRejectedValueOnce(new DOMException("Quota", "QuotaExceededError"));
  await expect(createTextDocument({ fileName: "failed.txt", bytes })).rejects.toThrow("Quota");
  expect(await getDb().items.count()).toBe(0);
  expect(await getDb().documentAssets.count()).toBe(0);
  expect(await getDb().backupState.get("library")).toBeUndefined();
});

test("editing a file replaces only its saved copy and retains shared originals and unchanged bytes", async () => {
  const first = await createTextDocument({ fileName: "first.md", bytes });
  const shared = await createTextDocument({ fileName: "shared.md", bytes });
  const unchanged = await updateDocument(first.id, { title: "Renamed", noteContent: "Personal note", content: "# Original\r\nUnicode مرحبا\n", expectedAssetId: first.assetId });
  expect(unchanged.assetId).toBe(first.assetId);
  expect((await getDocumentOriginal(first.id))?.bytes).toEqual(bytes);
  const changed = await updateDocument(first.id, { title: "Edited", noteContent: "Personal note", content: "# Updated body\nمرحبا", expectedAssetId: first.assetId });
  expect(changed.assetId).not.toBe(first.assetId);
  expect(new TextDecoder().decode((await getDocumentOriginal(first.id))?.bytes)).toBe("# Updated body\nمرحبا");
  expect((await getDocumentOriginal(shared.id))?.bytes).toEqual(bytes);
  expect(await getDb().documentAssets.count()).toBe(2);
  await expect(updateDocument(first.id, { title: "Stale", noteContent: "", content: "Older edit", expectedAssetId: first.assetId })).rejects.toThrow("changed while");
});

test("a failed edit preserves the original file and leaves no replacement asset", async () => {
  const item = await createTextDocument({ fileName: "safe.txt", bytes });
  vi.spyOn(getDb().items, "put").mockRejectedValueOnce(new DOMException("Quota", "QuotaExceededError"));
  await expect(updateDocument(item.id, { title: "Edited", noteContent: "", content: "Replacement" })).rejects.toThrow("Quota");
  expect((await getDocumentOriginal(item.id))?.bytes).toEqual(bytes);
  expect(await getDb().documentAssets.count()).toBe(1);
});

test("Trash preserves originals; permanent deletion keeps shared bytes until the last reference goes", async () => {
  const first = await createTextDocument({ fileName: "first.txt", bytes });
  const second = await createTextDocument({ fileName: "second.md", bytes });
  await deleteItem(first.id);
  expect((await getDocumentOriginal(first.id))?.bytes).toEqual(bytes);
  await restoreItem(first.id);
  expect((await getDb().items.get(first.id))?.deletedAt).toBeUndefined();
  await expect(permanentlyDeleteItem(first.id)).rejects.toThrow(/Trash/);
  await deleteItem(first.id);
  await permanentlyDeleteItem(first.id);
  expect(await getDb().documentAssets.count()).toBe(1);
  await deleteItem(second.id);
  await emptyTrash([second.id]);
  expect(await getDb().documentAssets.count()).toBe(0);
});
