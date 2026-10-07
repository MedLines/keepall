import { normalizeItem, type Item } from "@/domain/item";
import { getDb } from "./db";

export type UnsortedReviewAction = { kind: "file"; collectionId: string } | { kind: "tag"; tagId: string } | { kind: "delete" };
export type UnsortedReviewUndo =
  | { kind: "file"; itemId: string; collectionId: string; collectionAddedAt: number; previousCollectionAddedAt?: number }
  | { kind: "tag"; itemId: string; tagId: string }
  | { kind: "delete"; itemId: string; deletedAt: number };

export async function applyUnsortedReviewAction(itemId: string, action: UnsortedReviewAction): Promise<{ item: Item; undo: UnsortedReviewUndo | null }> {
  const db = getDb();
  return db.transaction("rw", db.items, db.collections, db.tags, async () => {
    const raw = await db.items.get(itemId);
    if (!raw || raw.deletedAt !== undefined) throw new Error("This item is no longer available in Unsorted. Skip to the next item.");
    const item = normalizeItem(raw);
    if (item.collectionIds.length) throw new Error("This item's collection changed elsewhere. Skip to the next item in Unsorted.");
    const now = Date.now();
    if (action.kind === "file") {
      if (!await db.collections.get(action.collectionId)) throw new Error("Collection no longer exists.");
      const next = { ...item, collectionIds: [action.collectionId], collectionAddedAt: now, updatedAt: now };
      await db.items.put(next);
      return { item: next, undo: { kind: "file", itemId, collectionId: action.collectionId, collectionAddedAt: now, previousCollectionAddedAt: item.collectionAddedAt } };
    }
    if (action.kind === "tag") {
      if (!await db.tags.get(action.tagId)) throw new Error("Tag no longer exists.");
      if (item.tagIds.includes(action.tagId)) return { item, undo: null };
      const next = { ...item, tagIds: [...item.tagIds, action.tagId], updatedAt: now };
      await db.items.put(next);
      return { item: next, undo: { kind: "tag", itemId, tagId: action.tagId } };
    }
    const next = { ...item, deletedAt: now, updatedAt: now };
    await db.items.put(next);
    return { item: next, undo: { kind: "delete", itemId, deletedAt: now } };
  });
}

export async function undoUnsortedReviewAction(undo: UnsortedReviewUndo): Promise<Item> {
  const db = getDb();
  return db.transaction("rw", db.items, db.collections, async () => {
    const raw = await db.items.get(undo.itemId);
    if (!raw) throw new Error("This item no longer exists. Its review action cannot be undone.");
    const item = normalizeItem(raw);
    if (undo.kind === "file") {
      const collection = await db.collections.get(undo.collectionId);
      if (item.deletedAt !== undefined || item.collectionIds.length !== 1 || item.collectionIds[0] !== undo.collectionId || item.collectionAddedAt !== undo.collectionAddedAt || collection?.pinnedItemIds.includes(item.id)) {
        throw new Error("This item's organization changed elsewhere. Undo would replace that change.");
      }
      item.collectionIds = [];
      if (undo.previousCollectionAddedAt === undefined) delete item.collectionAddedAt;
      else item.collectionAddedAt = undo.previousCollectionAddedAt;
    } else if (undo.kind === "tag") {
      if (item.deletedAt !== undefined) throw new Error("This item changed elsewhere. Restore it from Trash before undoing its tag.");
      item.tagIds = item.tagIds.filter(id => id !== undo.tagId);
    } else {
      if (item.deletedAt !== undo.deletedAt) throw new Error("This item's Trash state changed elsewhere. Undo would replace that change.");
      delete item.deletedAt;
    }
    const next = { ...item, updatedAt: Date.now() };
    await db.items.put(next);
    return next;
  });
}
