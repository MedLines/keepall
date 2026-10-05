import { Blob as NodeBlob } from "node:buffer";
import { BlobReader, Uint8ArrayWriter, ZipReader } from "@zip.js/zip.js";
import { expect, test, vi } from "vitest";
import { buildImage } from "@/domain/image";
import { buildNote } from "@/domain/note";
import { hashAssetBytes } from "@/domain/asset";
import { putAsset } from "./assets";
import { exportKeepallArchive, importKeepallArchiveReplace } from "./backup-archive";
import { exportKeepallBackup, importKeepallBackupReplace } from "./backup";
import { createCollection } from "./collections";
import { getDb } from "./db";
import { getLibraryPreferences, pinCollection } from "./library-preferences";

test.each(["ZIP", "JSON"] as const)("%s export restores one consistent snapshot during a concurrent library replacement", async (format) => {
  const db = getDb();
  const asset = await putAsset({ mimeType: "image/png", bytes: new Uint8Array([1, 2, 3]) });
  const collection = await createCollection({ name: "Original collection" });
  await pinCollection(collection.id);
  const image = {
    ...buildImage({ assetId: asset.id, title: "Original image" }),
    collectionIds: [collection.id],
  };
  await db.items.put(image);
  const replacement = buildNote({ content: "Saved during export" });
  const readItems = db.items.toArray.bind(db.items);
  let concurrentSave: Promise<void> | undefined;
  const read = vi.spyOn(db.items, "toArray").mockImplementationOnce(() => {
    const originalItems = readItems();
    // Queue a separate writer between the item read and subsequent table reads.
    concurrentSave = db.transaction("rw!", db.tables, async () => {
      await Promise.all(db.tables.map((table) => table.clear()));
      await db.items.put(replacement);
    });
    return originalItems;
  });

  try {
    const backup = format === "ZIP"
      ? await exportKeepallArchive(123)
      : await exportKeepallBackup(123);
    await concurrentSave;
    expect(await db.items.toArray()).toEqual([replacement]);

    if (backup instanceof Blob) {
      await importKeepallArchiveReplace(backup);
    } else {
      await importKeepallBackupReplace(backup);
    }

    expect(await db.items.toArray()).toEqual([image]);
    const restoredAsset = await db.assets.get(asset.id);
    expect(restoredAsset).toMatchObject({
      id: asset.id, mimeType: asset.mimeType, byteLength: asset.byteLength,
      contentHash: asset.contentHash, createdAt: asset.createdAt,
    });
    expect(Array.from(restoredAsset!.bytes)).toEqual(Array.from(asset.bytes));
    expect(await db.collections.toArray()).toEqual([collection]);
    expect((await getLibraryPreferences()).pinnedCollectionIds).toEqual([collection.id]);
  } finally {
    read.mockRestore();
    await concurrentSave;
  }
});

test.each(["ZIP", "JSON"] as const)("%s export hashes legacy image bytes without modifying the working library", async (format) => {
  const db = getDb();
  const bytes = new Uint8Array([4, 5, 6]);
  const assetId = "11111111-1111-4111-8111-111111111111";
  const legacy = { id: assetId, mimeType: "image/png", bytes: bytes.buffer, createdAt: 1 };
  await db.assets.put(legacy as never);
  await db.items.put(buildImage({ assetId }));

  const backup = format === "ZIP"
    ? await exportKeepallArchive(123)
    : await exportKeepallBackup(123);
  expect(await db.assets.get(assetId)).toEqual(legacy);

  if (backup instanceof Blob) {
    await importKeepallArchiveReplace(backup);
  } else {
    await importKeepallBackupReplace(backup);
  }
  const restoredAsset = await db.assets.get(assetId);
  expect(restoredAsset).toMatchObject({
    byteLength: 3,
    contentHash: await hashAssetBytes(bytes),
  });
  expect(Array.from(restoredAsset!.bytes)).toEqual(Array.from(bytes));
});

test("ZIP export restores video and thumbnail bytes after the originals are removed", async () => {
  const { buildVideo } = await import("@/domain/video");
  const db = getDb();
  const assetId = "22222222-2222-4222-8222-222222222222";
  const videoBytes = new Uint8Array([7, 8, 9]);
  const thumbnailBytes = new Uint8Array([10, 11]);
  const video = buildVideo({ assetId, fileName: "original.mp4" });
  await db.items.put(video);
  await db.videoAssets.put({
    id: assetId, mimeType: "video/mp4", byteLength: 3, createdAt: 1,
    blob: new NodeBlob([videoBytes], { type: "video/mp4" }) as unknown as Blob,
  });
  await db.thumbnails.put({
    assetId, blob: new NodeBlob([thumbnailBytes], { type: "image/png" }) as unknown as Blob,
  });

  const backup = await exportKeepallArchive(123);
  await db.items.clear();
  await db.videoAssets.clear();
  await db.thumbnails.clear();
  await importKeepallArchiveReplace(backup);

  expect(await db.items.toArray()).toEqual([video]);
  expect((await db.videoAssets.get(assetId))?.byteLength).toBe(videoBytes.length);
  expect(await db.thumbnails.count()).toBe(1);
  const reader = new ZipReader(new BlobReader(backup));
  try {
    const entries = await reader.getEntries();
    const videoEntry = entries.find((entry) => entry.filename === `videos/${assetId}.bin`);
    const thumbnailEntry = entries.find((entry) => entry.filename === `thumbnails/${assetId}.bin`);
    if (!videoEntry || videoEntry.directory || !thumbnailEntry || thumbnailEntry.directory) {
      throw new Error("Expected video and thumbnail files in the archive");
    }
    expect(await videoEntry.getData(new Uint8ArrayWriter())).toEqual(videoBytes);
    expect(await thumbnailEntry.getData(new Uint8ArrayWriter())).toEqual(thumbnailBytes);
  } finally {
    await reader.close();
  }
});
