import { normalizeItem } from "@/domain/item";
import { orderCollectionsByPins } from "@/domain/library-preferences";
import { getDb } from "./db";
import { getLibraryPreferences } from "./library-preferences";

async function captureItem(itemId: string) {
  const row = await getDb().items.get(itemId);
  if (!row || (row.type !== "link" && row.type !== "image")) {
    throw new Error("This item is no longer available in Keepall.");
  }
  return normalizeItem(row);
}

export async function getCaptureCollections(itemId: string) {
  const [item, collections, preferences] = await Promise.all([
    captureItem(itemId), getDb().collections.orderBy("name").toArray(), getLibraryPreferences(),
  ]);
  return {
    collections: orderCollectionsByPins(collections, preferences.pinnedCollectionIds).map(({ id, name }) => ({ id, name })),
    collectionIds: item.collectionIds,
  };
}

export async function moveCaptureToCollection(itemId: string, collectionId: string | null, expectedCollectionIds: string[]) {
  const db = getDb();
  return db.transaction("rw", db.items, db.collections, async () => {
    const item = await captureItem(itemId);
    if (JSON.stringify(item.collectionIds) !== JSON.stringify(expectedCollectionIds)) {
      throw new Error("This item's collection changed in Keepall. Close Organize and try again.");
    }
    const collection = collectionId === null ? undefined : await db.collections.get(collectionId);
    if (collectionId !== null && !collection) throw new Error("This collection is no longer available. Close Organize and try again.");
    const collectionIds = collectionId === null ? [] : [collectionId];
    const changed = JSON.stringify(item.collectionIds) !== JSON.stringify(collectionIds);
    if (changed) await db.items.update(itemId, { collectionIds, updatedAt: Date.now() });
    return { collectionName: collection?.name ?? "Unsorted", changed };
  });
}
