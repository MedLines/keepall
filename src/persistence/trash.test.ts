import { beforeEach, expect, test, vi } from "vitest";
import { deleteKeepallDatabase, getDb } from "./db";
import { createCollection, pinItemInCollection } from "./collections";
import { createTag } from "./tags";
import { createVideo } from "./videos";
import { createImage, createLink, createNote, deleteItem, getItem, listItems, listNotes, listTrashedItems, restoreItem, permanentlyDeleteItem, findLinkByNormalizedUrl, findImageByAssetPayloads, buildSingleAssetImageHashIndex } from "./items";
import { exportKeepallBackup, importKeepallBackupReplace } from "./backup";

beforeEach(deleteKeepallDatabase);

test("trash hides an item while preserving its content, organization and pins for restoration", async () => {
  const note = await createNote({ content: "Remember this", title: "Saved note" });
  const tag = await createTag({ name: "important" });
  const collection = await createCollection({ name: "Reading" });
  await getDb().items.update(note.id, { tagIds: [tag.id], collectionIds: [collection.id] });
  await pinItemInCollection(collection.id, note.id);
  await deleteItem(note.id);
  expect(await listItems()).toEqual([]);
  expect(await listNotes()).toEqual([]);
  expect(await getItem(note.id)).toBeNull();
  expect(await listTrashedItems()).toMatchObject([{ id: note.id, content: note.content, deletedAt: expect.any(Number) }]);
  await restoreItem(note.id);
  expect(await getItem(note.id)).toMatchObject({ content: note.content, tagIds: [tag.id], collectionIds: [collection.id], createdAt: note.createdAt });
  expect((await getDb().collections.get(collection.id))?.pinnedItemIds).toEqual([note.id]);
  expect(await listTrashedItems()).toEqual([]);
});

test("trash is excluded from capture duplicate matching", async () => {
  const link = await createLink({ url: "https://example.com" });
  const assets = [{ bytes: new Uint8Array([1]), mimeType: "image/png" }];
  const image = await createImage({ assets });
  await deleteItem(link.id);
  await deleteItem(image.id);
  expect(await findLinkByNormalizedUrl(link.url)).toBeNull();
  expect(await findImageByAssetPayloads(assets)).toBeNull();
  expect((await buildSingleAssetImageHashIndex()).size).toBe(0);
});

test("only trashed items can be permanently deleted and shared media is retained until the last reference", async () => {
  const assets = [{ bytes: new Uint8Array([2]), mimeType: "image/png" }];
  const first = await createImage({ assets });
  const second = await createImage({ assets });
  const id = first.assetIds[0];
  expect(second.assetIds).toEqual(first.assetIds);
  await expect(permanentlyDeleteItem(first.id)).rejects.toThrow("Trash");
  await deleteItem(first.id);
  await deleteItem(second.id);
  expect(await getDb().assets.get(id)).toBeDefined();
  await permanentlyDeleteItem(first.id);
  expect(await getDb().assets.get(id)).toBeDefined();
  await permanentlyDeleteItem(second.id);
  expect(await getDb().assets.get(id)).toBeUndefined();
});

test("video originals and posters survive trash and restore", async () => {
  const video = await createVideo(new File(["abc"], "clip.mp4", { type: "video/mp4" }), new Blob(["poster"], { type: "image/png" }));
  await deleteItem(video.id);
  expect(await getDb().videoAssets.get(video.assetId)).toBeDefined();
  expect(await getDb().thumbnails.get(video.assetId)).toBeDefined();
  await restoreItem(video.id);
  expect(await getItem(video.id)).toMatchObject({ assetId: video.assetId });
  await deleteItem(video.id);
  await permanentlyDeleteItem(video.id);
  expect(await getDb().videoAssets.get(video.assetId)).toBeUndefined();
  expect(await getDb().thumbnails.get(video.assetId)).toBeUndefined();
});

test("backup replacement preserves trash state and invalid deletion dates are rejected", async () => {
  const note = await createNote({ content: "Backup this" });
  await deleteItem(note.id);
  const backup = await exportKeepallBackup();
  await deleteKeepallDatabase();
  await importKeepallBackupReplace(backup);
  expect(await listItems()).toEqual([]);
  expect(await listTrashedItems()).toMatchObject([{ id: note.id }]);
  await expect(importKeepallBackupReplace({ ...backup, items: [{ ...backup.items[0], deletedAt: "bad" }] })).rejects.toThrow();
  expect(await listTrashedItems()).toHaveLength(1);
});

test("deleting twice keeps the original trash date and restoring an active item is a no-op", async () => {
  const note = await createNote({ content: "Idempotent" });
  await restoreItem(note.id);
  expect(await getItem(note.id)).toEqual(note);
  await deleteItem(note.id);
  const first = await listTrashedItems();
  await deleteItem(note.id);
  expect(await listTrashedItems()).toEqual(first);
});

test("permanent deletion removes collection pins", async () => {
  const note = await createNote({ content: "Pinned" });
  const collection = await createCollection({ name: "Reading" });
  await getDb().items.update(note.id, { collectionIds: [collection.id] });
  await pinItemInCollection(collection.id, note.id);
  await deleteItem(note.id);
  await permanentlyDeleteItem(note.id);
  expect((await getDb().collections.get(collection.id))?.pinnedItemIds).toEqual([]);
});

test("stale writes cannot resurrect a trashed or permanently removed item", async () => {
  const { putActiveItem } = await import("./active-item");
  const note = await createNote({ content: "Before deletion" });
  await deleteItem(note.id);
  await expect(putActiveItem({ ...note, content: "Late save" })).rejects.toThrow();
  expect(await listTrashedItems()).toMatchObject([{ content: "Before deletion" }]);
  await permanentlyDeleteItem(note.id);
  await expect(putActiveItem(note)).rejects.toThrow();
  expect(await getDb().items.count()).toBe(0);
});

test("a ZIP backup retains trashed video media and allows restoration", async () => {
  const { Blob: NodeBlob } = await import("node:buffer");
  const { exportKeepallArchive, importKeepallArchiveReplace } = await import("./backup-archive");
  const file = Object.assign(new NodeBlob(["abc"], { type: "video/mp4" }), { name: "clip.mp4" }) as unknown as File;
  const video = await createVideo(file);
  await deleteItem(video.id);
  const archive = await exportKeepallArchive();
  await deleteKeepallDatabase();
  await importKeepallArchiveReplace(archive);
  expect(await listItems()).toEqual([]);
  expect(await listTrashedItems()).toMatchObject([{ id: video.id, deletedAt: expect.any(Number) }]);
  expect((await getDb().videoAssets.get(video.assetId))?.byteLength).toBe(3);
  await restoreItem(video.id);
  expect(await getItem(video.id)).toMatchObject({ id: video.id, assetId: video.assetId });
});

test("backup merge keeps active and trashed copies of the same link or image separate", async () => {
  const { importKeepallBackupMerge } = await import("./backup");
  const oldLink = await createLink({ url: "https://example.com/again", noteContent: "Old note" });
  await deleteItem(oldLink.id);
  const currentLink = await createLink({ url: oldLink.url, noteContent: "New note" });
  const assets = [{ bytes: new Uint8Array([4]), mimeType: "image/png" }];
  const oldImage = await createImage({ assets, caption: "Old caption" });
  await deleteItem(oldImage.id);
  const currentImage = await createImage({ assets, caption: "New caption" });
  const backup = await exportKeepallBackup();
  await deleteKeepallDatabase();
  await importKeepallBackupMerge(backup);
  expect((await listItems()).map((item) => item.id).sort()).toEqual([currentLink.id, currentImage.id].sort());
  expect((await listTrashedItems()).map((item) => item.id).sort()).toEqual([oldLink.id, oldImage.id].sort());
  await importKeepallBackupMerge(backup);
  expect(await getDb().items.count()).toBe(4);
});


test("failed media cleanup rolls permanent deletion back so the item remains recoverable", async () => {
  const image = await createImage({ assets: [{ bytes: new Uint8Array([5]), mimeType: "image/png" }] });
  await deleteItem(image.id);
  const cleanup = vi.spyOn(getDb().assets, "bulkDelete").mockRejectedValueOnce(new Error("Write failed"));
  try {
    await expect(permanentlyDeleteItem(image.id)).rejects.toThrow("Write failed");
  } finally {
    cleanup.mockRestore();
  }
  expect(await listTrashedItems()).toMatchObject([{ id: image.id }]);
  expect(await getDb().assets.get(image.assetIds[0])).toBeDefined();
  await restoreItem(image.id);
  expect(await getItem(image.id)).toMatchObject({ id: image.id });
});
