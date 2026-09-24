import {
  buildKeepallBackup,
  parseKeepallBackup,
  type KeepallBackup,
} from "@/domain/backup";
import { base64ToBytes, bytesToBase64 } from "@/domain/backup-encoding";
import { isIncomingNewer, unionIds } from "@/domain/backup-merge";
import { buildAsset, sameContentHashMultiset } from "@/domain/asset";
import { normalizeCollection } from "@/domain/collection";
import { normalizePinnedCollectionIds } from "@/domain/library-preferences";
import { normalizeItem } from "@/domain/item";
import type { VideoItem } from "@/domain/video";
import type { ImageItem } from "@/domain/image";
import type { LinkItem } from "@/domain/link";
import { normalizeLinkUrl } from "@/domain/link";
import { replaceNoteImageAssetIds, type NoteItem } from "@/domain/note";
import { listAssets, putAsset, ensureContentHash, getAsset } from "./assets";
import { createCollection } from "./collections";
import { getDb, type Thumbnail, type VideoAsset } from "./db";
import { imageThumbnail, putThumbnail } from "./thumbnails";
import {
  getLibraryPreferences,
  putLibraryPreferences,
} from "./library-preferences";
import { createTag } from "./tags";

export async function exportKeepallBackup(
  exportedAt?: number,
): Promise<KeepallBackup> {
  const db = getDb();
  const [rawItems, tags, collections, assets, preferences] = await Promise.all([
    db.items.toArray(),
    db.tags.toArray(),
    db.collections.toArray(),
    listAssets(),
    getLibraryPreferences(),
  ]);

  if (rawItems.some((item) => item.type === "video")) {
    throw new Error("Use ZIP export for libraries containing video");
  }

  const backupAssets = assets.map((asset) => ({
    id: asset.id,
    mimeType: asset.mimeType,
    byteLength: asset.byteLength,
    dataBase64: bytesToBase64(asset.bytes),
    contentHash: asset.contentHash || undefined,
    createdAt: asset.createdAt,
  }));

  return buildKeepallBackup({
    items: rawItems.map((item) => normalizeItem(item)),
    tags,
    collections,
    assets: backupAssets,
    exportedAt,
    preferences: {
      pinnedCollectionIds: normalizePinnedCollectionIds(
        preferences.pinnedCollectionIds,
        collections.map((collection) => collection.id),
      ),
    },
  });
}

export async function importKeepallBackupReplace(
  raw: unknown,
  binaryAssets?: Map<string, Uint8Array>,
): Promise<KeepallBackup> {
  return replaceValidatedBackup(parseKeepallBackup(raw), binaryAssets);
}

export async function replaceValidatedBackup(
  backup: KeepallBackup,
  binaryAssets?: Map<string, Uint8Array>,
  videos: VideoAsset[] = [],
  thumbnails: Thumbnail[] = [],
): Promise<KeepallBackup> {
  const db = getDb();

  const restoredAssets = backup.assets.map((record) =>
    buildAsset(
      {
        mimeType: record.mimeType,
        bytes: binaryAssets?.get(record.id) ?? base64ToBytes(record.dataBase64),
        contentHash: record.contentHash,
      },
      { id: record.id, now: record.createdAt },
    ),
  );

  const imageAssetIds = new Set(backup.items.filter((item) => item.type === "image").flatMap((item) => item.assetIds));
  const existingThumbnailIds = new Set(thumbnails.map((thumbnail) => thumbnail.assetId));
  const generatedThumbnails: Thumbnail[] = [];
  for (const asset of restoredAssets) {
    if (!imageAssetIds.has(asset.id) || existingThumbnailIds.has(asset.id)) continue;
    const blob = await imageThumbnail(asset.bytes, asset.mimeType);
    if (blob) generatedThumbnails.push({ assetId: asset.id, blob });
  }

  await db.transaction(
    "rw",
    [db.items, db.tags, db.collections, db.assets, db.thumbnails, db.videoAssets, db.preferences],
    async () => {
      await Promise.all([
        db.items.clear(),
        db.tags.clear(),
        db.collections.clear(),
        db.assets.clear(),
        db.thumbnails.clear(),
        db.videoAssets.clear(),
        db.preferences.clear(),
      ]);

      if (backup.tags.length > 0) {
        await db.tags.bulkAdd(backup.tags);
      }

      if (backup.collections.length > 0) {
        await db.collections.bulkAdd(backup.collections);
      }

      if (restoredAssets.length > 0) {
        await db.assets.bulkAdd(restoredAssets);
      }

      if (videos.length > 0) {
        await db.videoAssets.bulkAdd(videos);
      }
      if (thumbnails.length + generatedThumbnails.length > 0) {
        await db.thumbnails.bulkAdd([...thumbnails, ...generatedThumbnails]);
      }

      if (backup.items.length > 0) {
        await db.items.bulkAdd(backup.items);
      }
      await db.preferences.put({
        id: "library",
        pinnedCollectionIds: backup.preferences.pinnedCollectionIds,
      });
    },
  );

  return backup;
}

export type KeepallMergeSummary = {
  added: number;
  updated: number;
  unchanged: number;
  addedLinkIds: string[];
};

/**
 * Merge a `.keepall` backup into the current library (no wipe).
 * Identity: notes by id, links by normalized URL, images by content hash.
 * Field conflicts: newer updatedAt wins. Tags: union. Collection: newer wins.
 */
export async function importKeepallBackupMerge(
  raw: unknown,
  binaryAssets?: Map<string, Uint8Array>,
  media?: { items: VideoItem[]; assets: VideoAsset[]; thumbnails: Thumbnail[] },
): Promise<{ backup: KeepallBackup; summary: KeepallMergeSummary }> {
  const backup = parseKeepallBackup(raw);
  const db = getDb();

  const tagIdMap = new Map<string, string>();
  for (const tag of backup.tags) {
    const local = await createTag({ name: tag.name });
    tagIdMap.set(tag.id, local.id);
  }

  const collectionIdMap = new Map<string, string>();
  for (const collection of backup.collections) {
    const local = await createCollection({ name: collection.name });
    collectionIdMap.set(collection.id, local.id);
  }

  const localPreferences = await getLibraryPreferences();
  const importedPinnedCollectionIds = backup.preferences.pinnedCollectionIds
    .map((id) => collectionIdMap.get(id))
    .filter((id): id is string => Boolean(id));
  await putLibraryPreferences(
    unionIds(
      localPreferences.pinnedCollectionIds,
      importedPinnedCollectionIds,
    ),
  );

  const assetIdMap = new Map<string, string>();
  for (const record of backup.assets) {
    const local = await putAsset({
      mimeType: record.mimeType,
      bytes: binaryAssets?.get(record.id) ?? base64ToBytes(record.dataBase64),
      contentHash: record.contentHash,
    });
    assetIdMap.set(record.id, local.id);
    const storedThumbnail = media?.thumbnails.find((thumbnail) => thumbnail.assetId === record.id);
    const blob = storedThumbnail?.blob ?? (backup.items.some((item) => item.type === "image" && item.assetIds.includes(record.id))
      ? await imageThumbnail(binaryAssets?.get(record.id) ?? base64ToBytes(record.dataBase64), record.mimeType)
      : null);
    await putThumbnail(local.id, blob);
  }

  const remapTagIds = (ids: string[]) =>
    unionIds(ids.map((id) => tagIdMap.get(id)).filter((id): id is string => !!id));

  const remapCollectionIds = (ids: string[]) => {
    const remapped = ids
      .map((id) => collectionIdMap.get(id))
      .filter((id): id is string => !!id);
    return remapped.slice(0, 1);
  };

  const remapAssetId = (id: string | null): string | null => {
    if (!id) {
      return null;
    }
    return assetIdMap.get(id) ?? null;
  };

  const itemIdMap = new Map<string, string>();
  const summary: KeepallMergeSummary = {
    added: 0,
    updated: 0,
    unchanged: 0,
    addedLinkIds: [],
  };

  const localItems = (await db.items.toArray()).map((row) => normalizeItem(row));
  const notesById = new Map<string, NoteItem>();
  const linksByUrl = new Map<string, LinkItem>();
  const images: ImageItem[] = [];

  for (const item of localItems) {
    if (item.type === "note") {
      notesById.set(item.id, item);
    } else if (item.type === "link") {
      const key = normalizeLinkUrl(item.url);
      if (key) {
        linksByUrl.set(key, item);
      }
    } else if (item.type === "image") {
      images.push(item);
    }
  }

  async function findImageByRemappedAssets(
    backupImage: ImageItem,
  ): Promise<ImageItem | null> {
    const hashes: string[] = [];
    for (const backupAssetId of backupImage.assetIds) {
      const localAssetId = assetIdMap.get(backupAssetId);
      if (!localAssetId) {
        return null;
      }
      const asset = await getAsset(localAssetId);
      if (!asset) {
        return null;
      }
      const hashed = await ensureContentHash(asset);
      hashes.push(hashed.contentHash);
    }
    if (hashes.length === 0) {
      return null;
    }

    for (const image of images) {
      if (image.assetIds.length !== hashes.length) {
        continue;
      }
      const imageHashes: string[] = [];
      let missing = false;
      for (const assetId of image.assetIds) {
        const asset = await getAsset(assetId);
        if (!asset) {
          missing = true;
          break;
        }
        const hashed = await ensureContentHash(asset);
        imageHashes.push(hashed.contentHash);
      }
      if (missing) {
        continue;
      }
      if (sameContentHashMultiset(hashes, imageHashes)) {
        return image;
      }
    }
    return null;
  }

  function mergeOrg(
    local: { tagIds: string[]; collectionIds: string[]; updatedAt: number },
    incoming: { tagIds: string[]; collectionIds: string[]; updatedAt: number },
  ): { tagIds: string[]; collectionIds: string[] } {
    const incomingTags = remapTagIds(incoming.tagIds);
    const tagIds = unionIds(local.tagIds, incomingTags);
    const useIncoming = isIncomingNewer(local.updatedAt, incoming.updatedAt);
    const collectionIds = useIncoming
      ? remapCollectionIds(incoming.collectionIds)
      : local.collectionIds;
    return { tagIds, collectionIds };
  }

  for (const rawIncoming of backup.items) {
    const incoming = normalizeItem(rawIncoming);

    if (incoming.type === "note") {
      const local = notesById.get(incoming.id);
      if (!local) {
        const idTaken = await db.items.get(incoming.id);
        const id = idTaken ? crypto.randomUUID() : incoming.id;
        const next: NoteItem = {
          ...incoming,
          id,
          content: replaceNoteImageAssetIds(incoming.content, assetIdMap),
          tagIds: remapTagIds(incoming.tagIds),
          collectionIds: remapCollectionIds(incoming.collectionIds),
        };
        await db.items.put(next);
        notesById.set(next.id, next);
        itemIdMap.set(incoming.id, next.id);
        summary.added += 1;
        continue;
      }

      const org = mergeOrg(local, incoming);
      const useIncoming = isIncomingNewer(local.updatedAt, incoming.updatedAt);
      if (!useIncoming && org.tagIds.length === local.tagIds.length) {
        const sameTags = org.tagIds.every((id, i) => id === local.tagIds[i]);
        if (sameTags) {
          itemIdMap.set(incoming.id, local.id);
          summary.unchanged += 1;
          continue;
        }
      }
      const next: NoteItem = useIncoming
        ? {
            ...incoming,
            id: local.id,
            content: replaceNoteImageAssetIds(incoming.content, assetIdMap),
            tagIds: org.tagIds,
            collectionIds: org.collectionIds,
          }
        : {
            ...local,
            tagIds: org.tagIds,
            collectionIds: org.collectionIds,
            updatedAt:
              org.tagIds.length !== local.tagIds.length
                ? Math.max(local.updatedAt, incoming.updatedAt)
                : local.updatedAt,
          };
      await db.items.put(next);
      notesById.set(next.id, next);
      itemIdMap.set(incoming.id, local.id);
      summary.updated += 1;
      continue;
    }

    if (incoming.type === "link") {
      const urlKey = normalizeLinkUrl(incoming.url);
      const local = urlKey ? linksByUrl.get(urlKey) : undefined;

      if (!local) {
        const idTaken = await db.items.get(incoming.id);
        const id = idTaken ? crypto.randomUUID() : incoming.id;
        const next: LinkItem = {
          ...incoming,
          id,
          tagIds: remapTagIds(incoming.tagIds),
          collectionIds: remapCollectionIds(incoming.collectionIds),
          previewAssetId: remapAssetId(incoming.previewAssetId),
        };
        await db.items.put(next);
        if (urlKey) {
          linksByUrl.set(urlKey, next);
        }
        itemIdMap.set(incoming.id, next.id);
        summary.added += 1;
        summary.addedLinkIds.push(next.id);
        continue;
      }

      const org = mergeOrg(local, incoming);
      const useIncoming = isIncomingNewer(local.updatedAt, incoming.updatedAt);
      const next: LinkItem = useIncoming
        ? {
            ...incoming,
            id: local.id,
            url: local.url,
            tagIds: org.tagIds,
            collectionIds: org.collectionIds,
            previewAssetId: remapAssetId(incoming.previewAssetId),
          }
        : {
            ...local,
            tagIds: org.tagIds,
            collectionIds: org.collectionIds,
            previewAssetId: local.previewAssetId,
            updatedAt:
              org.tagIds.length !== local.tagIds.length
                ? Math.max(local.updatedAt, incoming.updatedAt)
                : local.updatedAt,
          };

      const unchanged =
        !useIncoming &&
        next.tagIds.length === local.tagIds.length &&
        next.tagIds.every((id, i) => id === local.tagIds[i]) &&
        next.collectionIds[0] === local.collectionIds[0];

      if (unchanged) {
        itemIdMap.set(incoming.id, local.id);
        summary.unchanged += 1;
        continue;
      }

      await db.items.put(next);
      if (urlKey) {
        linksByUrl.set(urlKey, next);
      }
      itemIdMap.set(incoming.id, local.id);
      summary.updated += 1;
      continue;
    }

    if (incoming.type === "image") {
      const local = await findImageByRemappedAssets(incoming);

      if (!local) {
        const idTaken = await db.items.get(incoming.id);
        const id = idTaken ? crypto.randomUUID() : incoming.id;
        const next: ImageItem = {
          ...incoming,
          id,
          assetIds: incoming.assetIds
            .map((assetId) => assetIdMap.get(assetId))
            .filter((assetId): assetId is string => !!assetId),
          tagIds: remapTagIds(incoming.tagIds),
          collectionIds: remapCollectionIds(incoming.collectionIds),
        };
        if (next.assetIds.length === 0) {
          summary.unchanged += 1;
          continue;
        }
        await db.items.put(next);
        images.push(next);
        itemIdMap.set(incoming.id, next.id);
        summary.added += 1;
        continue;
      }

      const org = mergeOrg(local, incoming);
      const useIncoming = isIncomingNewer(local.updatedAt, incoming.updatedAt);
      const next: ImageItem = useIncoming
        ? {
            ...incoming,
            id: local.id,
            assetIds: local.assetIds,
            tagIds: org.tagIds,
            collectionIds: org.collectionIds,
          }
        : {
            ...local,
            tagIds: org.tagIds,
            collectionIds: org.collectionIds,
            updatedAt:
              org.tagIds.length !== local.tagIds.length
                ? Math.max(local.updatedAt, incoming.updatedAt)
                : local.updatedAt,
          };

      const unchanged =
        !useIncoming &&
        next.tagIds.length === local.tagIds.length &&
        next.tagIds.every((id, i) => id === local.tagIds[i]);

      if (unchanged) {
        itemIdMap.set(incoming.id, local.id);
        summary.unchanged += 1;
        continue;
      }

      await db.items.put(next);
      const idx = images.findIndex((image) => image.id === local.id);
      if (idx >= 0) {
        images[idx] = next;
      }
      itemIdMap.set(incoming.id, local.id);
      summary.updated += 1;
    }
  }

  if (media) {
    const videoAssetsById = new Map(media.assets.map((asset) => [asset.id, asset]));
    const thumbnailsById = new Map(media.thumbnails.map((thumbnail) => [thumbnail.assetId, thumbnail]));
    for (const incoming of media.items) {
      const source = videoAssetsById.get(incoming.assetId);
      if (!source) throw new Error("Video asset is missing from archive");
      const existing = await db.items.get(incoming.id);
      if (existing?.type === "video") {
        itemIdMap.set(incoming.id, existing.id);
        summary.unchanged += 1;
        continue;
      }
      const id = existing ? crypto.randomUUID() : incoming.id;
      const assetId = crypto.randomUUID();
      const next: VideoItem = {
        ...incoming, id, assetId,
        tagIds: remapTagIds(incoming.tagIds),
        collectionIds: remapCollectionIds(incoming.collectionIds),
      };
      await db.transaction("rw", db.items, db.videoAssets, db.thumbnails, async () => {
        await db.videoAssets.add({ ...source, id: assetId });
        const thumbnail = thumbnailsById.get(incoming.assetId);
        if (thumbnail) await db.thumbnails.add({ assetId, blob: thumbnail.blob });
        await db.items.add(next);
      });
      itemIdMap.set(incoming.id, id);
      summary.added += 1;
    }
  }

  for (const backupCollection of backup.collections) {
    const localId = collectionIdMap.get(backupCollection.id);
    if (!localId) {
      continue;
    }
    const existing = await db.collections.get(localId);
    if (!existing) {
      continue;
    }
    const local = normalizeCollection(existing);
    const remappedPins = backupCollection.pinnedItemIds
      .map((id) => itemIdMap.get(id))
      .filter((id): id is string => !!id);
    const candidatePins = unionIds(local.pinnedItemIds, remappedPins);
    const itemsNow = (await db.items.toArray()).map((row) => normalizeItem(row));
    const inCollection = new Set(
      itemsNow
        .filter((item) => item.collectionIds[0] === localId)
        .map((item) => item.id),
    );
    const pinnedItemIds = candidatePins.filter((id) => inCollection.has(id));
    if (
      pinnedItemIds.length === local.pinnedItemIds.length &&
      pinnedItemIds.every((id, i) => id === local.pinnedItemIds[i])
    ) {
      continue;
    }
    await db.collections.put(
      normalizeCollection({
        ...local,
        pinnedItemIds,
      }),
    );
  }

  return { backup, summary };
}

export async function libraryHasLocalData(): Promise<boolean> {
  const db = getDb();
  const [itemCount, tagCount, collectionCount, assetCount, videoCount] = await Promise.all([
    db.items.count(),
    db.tags.count(),
    db.collections.count(),
    db.assets.count(),
    db.videoAssets.count(),
  ]);

  return itemCount + tagCount + collectionCount + assetCount + videoCount > 0;
}
