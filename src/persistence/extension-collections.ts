import { normalizeItem } from "@/domain/item";
import { buildCollection } from "@/domain/collection";
import { assignTagId, buildTag, removeTagId } from "@/domain/tag";
import { orderCollectionsByPins } from "@/domain/library-preferences";
import { getDb } from "./db";
import { getLibraryPreferences } from "./library-preferences";

async function captureItem(itemId: string) {
  const row = await getDb().items.get(itemId);
  if (!row || row.deletedAt !== undefined || (row.type !== "link" && row.type !== "image")) {
    throw new Error("This item is no longer available in Keepall.");
  }
  return normalizeItem(row);
}

export async function getCaptureCollections(itemId: string) {
  const [item, collections, tags, preferences] = await Promise.all([
    captureItem(itemId), getDb().collections.orderBy("name").toArray(), getDb().tags.orderBy("name").toArray(), getLibraryPreferences(),
  ]);
  return {
    collections: orderCollectionsByPins(collections, preferences.pinnedCollectionIds).map(({ id, name }) => ({ id, name })),
    collectionIds: item.collectionIds,
    tags: tags.map(({ id, name }) => ({ id, name })),
    tagIds: item.tagIds,
  };
}

export async function moveCaptureToCollection(itemId: string, collectionId: string | null, expectedCollectionIds: string[], collectionName?: string) {
  const db = getDb();
  return db.transaction("rw", db.items, db.collections, async () => {
    const item = await captureItem(itemId);
    if (JSON.stringify(item.collectionIds) !== JSON.stringify(expectedCollectionIds)) {
      throw new Error("This item's collection changed in Keepall. Close Organize and try again.");
    }
    let collection = collectionId === null ? undefined : await db.collections.get(collectionId);
    if (collectionId !== null && !collection) throw new Error("This collection is no longer available. Close Organize and try again.");
    if (collectionName !== undefined) {
      const proposed = buildCollection({ name: collectionName });
      collection = await db.collections.filter((entry) => entry.name.toLowerCase() === proposed.name.toLowerCase()).first();
      if (!collection) {
        await db.collections.add(proposed);
        collection = proposed;
      }
    }
    const collectionIds = collection ? [collection.id] : [];
    const changed = JSON.stringify(item.collectionIds) !== JSON.stringify(collectionIds);
    if (changed) await db.items.update(itemId, { collectionIds, updatedAt: Date.now() });
    return { collectionName: collection?.name ?? "Unsorted", changed };
  });
}

type CaptureTagChange = {
  tagId?: string;
  tagName?: string;
  assigned: boolean;
  expectedTagIds: string[];
};

export async function updateCaptureTag(itemId: string, input: CaptureTagChange) {
  const db = getDb();
  return db.transaction("rw", db.items, db.tags, async () => {
    const item = await captureItem(itemId);
    if (JSON.stringify(item.tagIds) !== JSON.stringify(input.expectedTagIds)) {
      throw new Error("This item's tags changed in Keepall. Close Organize and try again.");
    }
    let tag = input.tagId ? await db.tags.get(input.tagId) : undefined;
    if (input.tagName !== undefined && input.assigned) {
      const proposed = buildTag({ name: input.tagName });
      tag = await db.tags.filter((entry) => entry.name.toLowerCase() === proposed.name.toLowerCase()).first();
      if (!tag) {
        await db.tags.add(proposed);
        tag = proposed;
      }
    }
    if (!tag) throw new Error("This tag is no longer available. Close Organize and try again.");
    const tagIds = input.assigned ? assignTagId(item.tagIds, tag.id) : removeTagId(item.tagIds, tag.id);
    const changed = JSON.stringify(item.tagIds) !== JSON.stringify(tagIds);
    if (changed) await db.items.update(itemId, { tagIds, updatedAt: Date.now() });
    return { tag: { id: tag.id, name: tag.name }, tagIds, assigned: input.assigned, changed };
  });
}
