import {
  buildCollection,
  clearCollectionId,
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

/** Deletes the collection row and clears that id from every item (Unsorted). */
export async function deleteCollection(collectionId: string): Promise<void> {
  const existing = await getDb().collections.get(collectionId);
  if (!existing) {
    throw new Error("Collection not found");
  }

  const db = getDb();
  await db.transaction("rw", db.collections, db.items, async () => {
    const items = await db.items.toArray();
    const now = Date.now();
    for (const raw of items) {
      const item = normalizeItem(raw);
      if (!item.collectionIds.includes(collectionId)) {
        continue;
      }
      const next: Item = {
        ...item,
        collectionIds: clearCollectionId(item.collectionIds, collectionId),
        updatedAt: now,
      };
      await db.items.put(next);
    }
    await db.collections.delete(collectionId);
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
