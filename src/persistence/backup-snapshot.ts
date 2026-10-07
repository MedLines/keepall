import { hashAssetBytes } from "@/domain/asset";
import { normalizeItem } from "@/domain/item";
import { normalizePinnedCollectionIds } from "@/domain/library-preferences";
import { coerceAsset } from "./assets";
import { getDb } from "./db";

export async function readBackupSnapshot() {
  const db = getDb();
  const [rawItems, tags, collections, rawAssets, videos, thumbnails, preferences, state, documents] = await db.transaction(
    "r",
    [db.items, db.tags, db.collections, db.assets, db.videoAssets, db.thumbnails, db.preferences, db.backupState, db.documentAssets],
    () => Promise.all([
      db.items.toArray(), db.tags.toArray(), db.collections.toArray(),
      db.assets.toArray(), db.videoAssets.toArray(), db.thumbnails.toArray(),
      db.preferences.get("library"), db.backupState.get("library"), db.documentAssets.toArray(),
    ]),
  );

  // Hash captured bytes after the transaction, without backfilling live rows.
  const assets = await Promise.all(rawAssets.map(async (row) => {
    const asset = coerceAsset(row);
    return asset.contentHash ? asset : {
      ...asset,
      contentHash: await hashAssetBytes(asset.bytes),
    };
  }));

  return {
    revision: state?.revision ?? "initial",
    items: rawItems.map((item) => normalizeItem(item)),
    tags, collections, assets, videos, thumbnails, documents,
    preferences: {
      ...(preferences?.keyboardShortcuts ? { keyboardShortcuts: preferences.keyboardShortcuts } : {}),
      pinnedCollectionIds: normalizePinnedCollectionIds(
        preferences?.pinnedCollectionIds, collections.map((collection) => collection.id),
      ),
    },
  };
}
