import {
  buildKeepallBackup,
  parseKeepallBackup,
  type KeepallBackup,
} from "@/domain/backup";
import { normalizeItem } from "@/domain/item";
import { getDb } from "./db";

export async function exportKeepallBackup(
  exportedAt?: number,
): Promise<KeepallBackup> {
  const db = getDb();
  const [rawItems, tags, collections] = await Promise.all([
    db.items.toArray(),
    db.tags.toArray(),
    db.collections.toArray(),
  ]);

  return buildKeepallBackup({
    items: rawItems.map((item) => normalizeItem(item)),
    tags,
    collections,
    exportedAt,
  });
}

export async function importKeepallBackupReplace(
  raw: unknown,
): Promise<KeepallBackup> {
  const backup = parseKeepallBackup(raw);
  const db = getDb();

  await db.transaction("rw", db.items, db.tags, db.collections, async () => {
    await Promise.all([
      db.items.clear(),
      db.tags.clear(),
      db.collections.clear(),
    ]);

    if (backup.tags.length > 0) {
      await db.tags.bulkAdd(backup.tags);
    }

    if (backup.collections.length > 0) {
      await db.collections.bulkAdd(backup.collections);
    }

    if (backup.items.length > 0) {
      await db.items.bulkAdd(backup.items);
    }
  });

  return backup;
}

export async function libraryHasLocalData(): Promise<boolean> {
  const db = getDb();
  const [itemCount, tagCount, collectionCount] = await Promise.all([
    db.items.count(),
    db.tags.count(),
    db.collections.count(),
  ]);

  return itemCount + tagCount + collectionCount > 0;
}
