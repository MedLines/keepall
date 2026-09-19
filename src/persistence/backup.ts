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
import { normalizeItem, type Item } from "@/domain/item";
import type { ImageItem } from "@/domain/image";
import type { LinkItem } from "@/domain/link";
import { normalizeLinkUrl } from "@/domain/link";
import type { NoteItem } from "@/domain/note";
import { listAssets, putAsset, ensureContentHash, getAsset } from "./assets";
import { createCollection } from "./collections";
import { getDb } from "./db";
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
): Promise<KeepallBackup> {
  const backup = parseKeepallBackup(raw);
  const db = getDb();

  const restoredAssets = backup.assets.map((record) =>
    buildAsset(
      {
        mimeType: record.mimeType,
        bytes: base64ToBytes(record.dataBase64),
        contentHash: record.contentHash,
      },
      { id: record.id, now: record.createdAt },
    ),
  );

  await db.transaction(
    "rw",
    db.items,
    db.tags,
    db.collections,
    db.assets,
    db.preferences,
    async () => {
      await Promise.all([
        db.items.clear(),
        db.tags.clear(),
        db.collections.clear(),
        db.assets.clear(),
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
      bytes: base64ToBytes(record.dataBase64),
      contentHash: record.contentHash,
    });
    assetIdMap.set(record.id, local.id);
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
  const [itemCount, tagCount, collectionCount, assetCount] = await Promise.all([
    db.items.count(),
    db.tags.count(),
    db.collections.count(),
    db.assets.count(),
  ]);

  return itemCount + tagCount + collectionCount + assetCount > 0;
}
