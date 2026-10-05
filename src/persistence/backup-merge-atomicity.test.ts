import { Blob as NodeBlob } from "node:buffer";
import { expect, test, vi } from "vitest";
import { buildAsset, hashAssetBytes } from "@/domain/asset";
import { buildKeepallBackup } from "@/domain/backup";
import { bytesToBase64 } from "@/domain/backup-encoding";
import { buildImage } from "@/domain/image";
import { buildLink } from "@/domain/link";
import { buildNote } from "@/domain/note";
import { buildVideo } from "@/domain/video";
import { putAsset } from "./assets";
import { importKeepallBackupMerge } from "./backup";
import { exportKeepallArchive, importKeepallArchiveMerge } from "./backup-archive";
import { readBackupSnapshot } from "./backup-snapshot";
import { createCollection } from "./collections";
import { getDb } from "./db";
import { createTextDocument, getDocumentOriginal } from "./documents";
import { putLibraryPreferences } from "./library-preferences";
import { createTag } from "./tags";

function blob(bytes: number[], type: string): Blob {
  return new NodeBlob([new Uint8Array(bytes)], { type }) as unknown as Blob;
}

async function storedBlob(blob: Blob) {
  // fake-indexeddb cannot preserve jsdom Blob internals when cloning archive imports.
  return typeof blob.arrayBuffer === "function"
    ? { type: blob.type, bytes: new Uint8Array(await blob.arrayBuffer()) }
    : blob;
}

async function storedLibrary() {
  const db = getDb();
  const [items, tags, collections, assets, thumbnails, videos, documents, preferences, backupState] = await Promise.all([
    db.items.toArray(), db.tags.toArray(), db.collections.toArray(), db.assets.toArray(),
    db.thumbnails.toArray(), db.videoAssets.toArray(), db.documentAssets.toArray(),
    db.preferences.toArray(), db.backupState.toArray(),
  ]);
  return {
    items, tags, collections, assets, documents, preferences, backupState,
    thumbnails: await Promise.all(thumbnails.map(async ({ assetId, blob }) => ({
      assetId, blob: await storedBlob(blob),
    }))),
    videos: await Promise.all(videos.map(async ({ blob, ...metadata }) => ({
      ...metadata, blob: await storedBlob(blob),
    }))),
  };
}

async function mergeFixture() {
  const db = getDb();
  const tag = await createTag({ name: "Local" });
  const collection = await createCollection({ name: "Reading" });
  const asset = await putAsset({ mimeType: "image/png", bytes: new Uint8Array([1, 2, 3]) });
  const organization = { tagIds: [tag.id], collectionIds: [collection.id] };
  const note = { ...buildNote({ content: "Original note" }, { id: "note", now: 100 }), ...organization };
  const link = { ...buildLink({ url: "https://example.com/original", title: "Original link" }, { id: "link", now: 100 }), ...organization, previewAssetId: asset.id };
  const image = { ...buildImage({ assetId: asset.id, title: "Original image" }, { id: "image", now: 100 }), ...organization };
  const videoId = crypto.randomUUID();
  const video = { ...buildVideo({ assetId: videoId, fileName: "local.mp4" }, { id: "local-video", now: 100 }), ...organization };
  await db.items.bulkPut([note, link, image, video]);
  await db.videoAssets.add({ id: videoId, mimeType: "video/mp4", byteLength: 3, blob: blob([4, 5, 6], "video/mp4"), createdAt: 100 });
  await db.thumbnails.bulkPut([
    { assetId: asset.id, blob: blob([7, 8], "image/webp") },
    { assetId: videoId, blob: blob([9, 10], "image/webp") },
  ]);
  const originalBytes = new TextEncoder().encode("\uFEFFOriginal file\r\nمرحبا\n");
  const document = await createTextDocument({ fileName: "original.md", bytes: originalBytes, noteContent: "Original personal note", ...organization });
  await db.collections.put({ ...collection, pinnedItemIds: [note.id] });
  await putLibraryPreferences([collection.id]);

  const incomingTag = { id: "incoming-tag", name: "Imported", createdAt: 200 };
  const existingCollection = { id: "incoming-reading", name: collection.name, createdAt: 200, pinnedItemIds: [link.id] };
  const newCollection = { id: "incoming-collection", name: "Imported", createdAt: 200, pinnedItemIds: ["new-link", "new-image"] };
  const incomingOrg = { tagIds: [incomingTag.id], collectionIds: [existingCollection.id], updatedAt: 200 };
  const addedOrg = { ...incomingOrg, collectionIds: [newCollection.id] };
  const incomingAsset = buildAsset({ mimeType: "image/png", bytes: new Uint8Array([11, 12, 13]), contentHash: await hashAssetBytes(new Uint8Array([11, 12, 13])) });
  const items = [
    { ...note, ...incomingOrg, content: "Imported note" },
    { ...link, ...incomingOrg, title: "Imported link", previewAssetId: incomingAsset.id },
    { ...image, ...incomingOrg, title: "Imported image" },
    { ...buildLink({ url: "https://example.com/new" }, { id: "new-link", now: 200 }), ...addedOrg },
    { ...buildImage({ assetId: incomingAsset.id }, { id: "new-image", now: 200 }), ...addedOrg },
  ];
  const incomingAssets = [asset, incomingAsset];
  const backup = buildKeepallBackup({
    items, tags: [incomingTag], collections: [existingCollection, newCollection],
    assets: incomingAssets.map(({ bytes, ...record }) => ({ ...record, dataBase64: bytesToBase64(bytes) })),
    preferences: { pinnedCollectionIds: [newCollection.id, existingCollection.id] }, exportedAt: 300,
  });

  async function archive() {
    const snapshot = await readBackupSnapshot();
    const bytes = new TextEncoder().encode("\uFEFFImported file\r\ncafé\n");
    const original = { id: crypto.randomUUID(), bytes, byteLength: bytes.byteLength, contentHash: await hashAssetBytes(bytes), createdAt: 200 };
    const importedDocument = { ...document, ...incomingOrg, assetId: original.id, updatedAt: document.updatedAt + 10_000, noteContent: "Imported personal note" };
    const importedVideoId = crypto.randomUUID();
    const importedVideo = { ...buildVideo({ assetId: importedVideoId, fileName: "incoming.mp4" }, { id: "new-video", now: 200 }), ...addedOrg };
    const result = await exportKeepallArchive(300, undefined, {
      ...snapshot, items: [...items, importedVideo, importedDocument, { ...importedDocument, id: "new-document" }],
      tags: backup.tags, collections: backup.collections, assets: incomingAssets,
      preferences: backup.preferences, documents: [original],
      videos: [{ id: importedVideoId, mimeType: "video/mp4", byteLength: 3, blob: blob([14, 15, 16], "video/mp4"), createdAt: 200 }],
      thumbnails: [
        { assetId: asset.id, blob: blob([17, 18], "image/webp") },
        { assetId: incomingAsset.id, blob: blob([19, 20], "image/webp") },
        { assetId: importedVideoId, blob: blob([21, 22], "image/webp") },
      ],
    });
    return new NodeBlob([new Uint8Array(await result.arrayBuffer())]) as unknown as Blob;
  }
  return { backup, archive, document, originalBytes };
}

function failImportedCollectionPins() {
  const table = getDb().collections;
  const put = table.put.bind(table);
  return vi.spyOn(table, "put").mockImplementation((collection, key) => {
    if (collection.name === "Imported") throw new DOMException("Storage full", "QuotaExceededError");
    return put(collection, key);
  });
}

test("JSON merge rolls back earlier edits, assets, organization, preferences and pins when the last pin write exceeds quota", async () => {
  const { backup } = await mergeFixture();
  const before = await storedLibrary();
  const failure = failImportedCollectionPins();
  try {
    await expect(importKeepallBackupMerge(JSON.parse(JSON.stringify(backup)))).rejects.toThrow("Storage full");
  } finally {
    failure.mockRestore();
  }
  expect(await storedLibrary()).toEqual(before);

  const { summary } = await importKeepallBackupMerge(backup);
  expect(summary).toEqual({ added: 2, updated: 3, unchanged: 0, addedLinkIds: ["new-link"] });
  expect((await getDb().items.toArray()).map((item) => item.id)).toHaveLength(before.items.length + 2);
  expect(await getDb().assets.count()).toBe(before.assets.length + 1);
  expect(await getDb().tags.count()).toBe(before.tags.length + 1);
  expect(await getDb().collections.count()).toBe(before.collections.length + 1);
  expect((await importKeepallBackupMerge(backup)).summary).toEqual({ added: 0, updated: 0, unchanged: 5, addedLinkIds: [] });
});

test.each(["document write", "final pin write"])("mixed ZIP merge rolls back the whole library after a failed %s and retries without duplicates", async (point) => {
  const { archive, document, originalBytes } = await mergeFixture();
  const incoming = await archive();
  const before = await storedLibrary();
  const put = getDb().items.put.bind(getDb().items);
  const failure = point === "final pin write" ? failImportedCollectionPins() : vi.spyOn(getDb().items, "put").mockImplementation((item, key) => {
    if (item.id === "new-document") throw new DOMException("Storage full", "QuotaExceededError");
    return put(item, key);
  });
  try {
    await expect(importKeepallArchiveMerge(incoming)).rejects.toThrow("Storage full");
  } finally {
    failure.mockRestore();
  }
  expect(await storedLibrary()).toEqual(before);
  expect((await getDocumentOriginal(document.id))?.bytes).toEqual(originalBytes);

  expect((await importKeepallArchiveMerge(incoming)).summary).toEqual({ added: 4, updated: 4, unchanged: 0, addedLinkIds: ["new-link"] });
  expect(await getDb().items.count()).toBe(before.items.length + 4);
  expect(await getDb().assets.count()).toBe(before.assets.length + 1);
  expect(await getDb().videoAssets.count()).toBe(before.videos.length + 1);
  expect(await getDb().thumbnails.count()).toBe(before.thumbnails.length + 2);
  expect(await getDb().documentAssets.count()).toBe(1);
  expect(await getDb().tags.count()).toBe(before.tags.length + 1);
  expect(await getDb().collections.count()).toBe(before.collections.length + 1);
  expect((await importKeepallArchiveMerge(incoming)).summary).toEqual({ added: 0, updated: 0, unchanged: 8, addedLinkIds: [] });
  expect(await getDb().items.count()).toBe(before.items.length + 4);
  expect(await getDb().documentAssets.count()).toBe(1);
});
