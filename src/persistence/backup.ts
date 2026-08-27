import {
  buildKeepallBackup,
  parseKeepallBackup,
  type KeepallBackup,
} from "@/domain/backup";
import { base64ToBytes, bytesToBase64 } from "@/domain/backup-encoding";
import { buildAsset } from "@/domain/asset";
import { normalizeItem } from "@/domain/item";
import { listAssets } from "./assets";
import { getDb } from "./db";

export async function exportKeepallBackup(
  exportedAt?: number,
): Promise<KeepallBackup> {
  const db = getDb();
  const [rawItems, tags, collections, assets] = await Promise.all([
    db.items.toArray(),
    db.tags.toArray(),
    db.collections.toArray(),
    listAssets(),
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
    async () => {
      await Promise.all([
        db.items.clear(),
        db.tags.clear(),
        db.collections.clear(),
        db.assets.clear(),
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
    },
  );

  return backup;
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
