import {
  buildCollection,
  coerceExclusiveCollectionIds,
  normalizeCollection,
  normalizeCollectionName,
  pinItemId,
  unpinItemId,
  type Collection,
  type CreateCollectionInput,
  CollectionValidationError,
} from "@/domain/collection";
import { normalizeItem, type Item } from "@/domain/item";
import { getDb } from "./db";

export async function createCollection(
  input: CreateCollectionInput,
): Promise<Collection> {
  const collection = buildCollection(input);
  const existing = await getDb()
    .collections.where("name")
    .equals(collection.name)
    .first();

  if (existing) {
    return normalizeCollection(existing);
  }

  await getDb().collections.add(collection);
  return collection;
}

/** Resolve a new import collection inside the caller's item/asset transaction. */
export async function resolveItemCollectionIds(ids: string[] = [], name?: string): Promise<string[]> {
  if (ids.length || !name?.trim()) return coerceExclusiveCollectionIds(ids);
  return [(await createCollection({ name })).id];
}

export async function listCollections(): Promise<Collection[]> {
  const rows = await getDb().collections.orderBy("name").toArray();
  return rows.map((row) => normalizeCollection(row));
}

export async function renameCollection(
  collectionId: string,
  name: string,
): Promise<Collection> {
  const normalized = normalizeCollectionName(name);
  if (!normalized) {
    throw new CollectionValidationError("Collection name is required");
  }

  const existing = await getDb().collections.get(collectionId);
  if (!existing) {
    throw new Error("Collection not found");
  }

  const conflict = await getDb()
    .collections.where("name")
    .equals(normalized)
    .first();
  if (conflict && conflict.id !== collectionId) {
    throw new CollectionValidationError("Collection name already exists");
  }

  const next: Collection = normalizeCollection({
    ...existing,
    name: normalized,
  });
  await getDb().collections.put(next);
  return next;
}

export type CollectionDeleteDestination = "unsorted" | "trash";

export async function deleteCollection(collectionId: string, destination: CollectionDeleteDestination = "unsorted"): Promise<void> {
  return deleteCollections([collectionId], destination);
}

export async function deleteCollections(collectionIds: string[], destination: CollectionDeleteDestination = "unsorted"): Promise<void> {
  const ids = [...new Set(collectionIds)];
  if (ids.length === 0) return;
  const removed = new Set(ids);
  const db = getDb();
  await db.transaction("rw", db.collections, db.items, db.preferences, async () => {
    const existing = await db.collections.bulkGet(ids);
    if (existing.some(collection => !collection)) throw new Error("Collection not found");
    const items = await db.items.toArray();
    const now = Date.now();
    for (const raw of items) {
      const item = normalizeItem(raw);
      if (!item.collectionIds.some(id => removed.has(id))) {
        continue;
      }
      const next: Item = {
        ...item,
        collectionIds: item.collectionIds.filter(id => !removed.has(id)),
        ...(destination === "trash" && item.deletedAt === undefined ? { deletedAt: now } : {}),
        updatedAt: now,
      };
      await db.items.put(next);
    }
    await db.collections.bulkDelete(ids);
    const preferences = await db.preferences.get("library");
    if (preferences?.pinnedCollectionIds.some(id => removed.has(id))) {
      await db.preferences.put({
        ...preferences,
        pinnedCollectionIds: preferences.pinnedCollectionIds.filter(id => !removed.has(id)),
      });
    }
  });
}

export async function pinItemInCollection(
  collectionId: string,
  itemId: string,
): Promise<Collection> {
  const existing = await getDb().collections.get(collectionId);
  if (!existing) {
    throw new Error("Collection not found");
  }

  const item = await getDb().items.get(itemId);
  if (!item) {
    throw new Error("Item not found");
  }

  const normalizedItem = normalizeItem(item);
  if (!normalizedItem.collectionIds.includes(collectionId)) {
    throw new Error("Item is not in this collection");
  }

  const collection = normalizeCollection(existing);
  const next = normalizeCollection({
    ...collection,
    pinnedItemIds: pinItemId(collection.pinnedItemIds, itemId),
  });
  await getDb().collections.put(next);
  return next;
}

export async function unpinItemInCollection(
  collectionId: string,
  itemId: string,
): Promise<Collection> {
  const existing = await getDb().collections.get(collectionId);
  if (!existing) {
    throw new Error("Collection not found");
  }

  const collection = normalizeCollection(existing);
  const next = normalizeCollection({
    ...collection,
    pinnedItemIds: unpinItemId(collection.pinnedItemIds, itemId),
  });
  await getDb().collections.put(next);
  return next;
}
