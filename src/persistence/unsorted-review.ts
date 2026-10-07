import { normalizeCollection } from "@/domain/collection";
import { normalizeItem, type Item } from "@/domain/item";
import { getDb } from "./db";

export type UnsortedReviewAction = { kind: "file"; collectionId: string } | { kind: "tag" | "remove-tag"; tagId: string } | { kind: "delete" };
export type UnsortedReviewUndo =
  | { kind: "file"; itemId: string; collectionId: string; collectionAddedAt: number; previousCollectionAddedAt?: number }
  | { kind: "tag"; itemId: string; tagId: string; updatedAt: number }
  | { kind: "remove-tag"; itemId: string; tagId: string; tagIndex: number; updatedAt: number }
  | { kind: "delete"; itemId: string; deletedAt: number };

export type UnsortedReviewMutation = { item: Item; previousUpdatedAt: number };

export function rebaseUnsortedReviewUndo(undo: UnsortedReviewUndo, mutation: UnsortedReviewMutation): UnsortedReviewUndo {
  return (undo.kind === "tag" || undo.kind === "remove-tag") && undo.itemId === mutation.item.id && undo.updatedAt === mutation.previousUpdatedAt
    ? { ...undo, updatedAt: mutation.item.updatedAt }
    : undo;
}

export async function applyUnsortedReviewAction(itemId: string, action: UnsortedReviewAction): Promise<UnsortedReviewMutation & { undo: UnsortedReviewUndo | null }> {
  const db = getDb();
  return db.transaction("rw", db.items, db.collections, db.tags, async () => {
    const raw = await db.items.get(itemId);
    if (!raw || raw.deletedAt !== undefined) throw new Error("This item is no longer available in Unsorted. Skip to the next item.");
    const item = normalizeItem(raw);
    if (item.collectionIds.length) throw new Error("This item's collection changed elsewhere. Skip to the next item in Unsorted.");
    const now = Math.max(Date.now(), item.updatedAt + 1);
    const previousUpdatedAt = item.updatedAt;
    if (action.kind === "file") {
      if (!await db.collections.get(action.collectionId)) throw new Error("Collection no longer exists.");
      const next = { ...item, collectionIds: [action.collectionId], collectionAddedAt: now, updatedAt: now };
      await db.items.put(next);
      return { item: next, previousUpdatedAt, undo: { kind: "file", itemId, collectionId: action.collectionId, collectionAddedAt: now, previousCollectionAddedAt: item.collectionAddedAt } };
    }
    if (action.kind === "tag") {
      if (!await db.tags.get(action.tagId)) throw new Error("Tag no longer exists.");
      if (item.tagIds.includes(action.tagId)) return { item, previousUpdatedAt, undo: null };
      const next = { ...item, tagIds: [...item.tagIds, action.tagId], updatedAt: now };
      await db.items.put(next);
      return { item: next, previousUpdatedAt, undo: { kind: "tag", itemId, tagId: action.tagId, updatedAt: now } };
    }
    if (action.kind === "remove-tag") {
      const tagIndex = item.tagIds.indexOf(action.tagId);
      if (tagIndex < 0) return { item, previousUpdatedAt, undo: null };
      const next = { ...item, tagIds: item.tagIds.filter(id => id !== action.tagId), updatedAt: now };
      await db.items.put(next);
      return { item: next, previousUpdatedAt, undo: { kind: "remove-tag", itemId, tagId: action.tagId, tagIndex, updatedAt: now } };
    }
    const next = { ...item, deletedAt: now, updatedAt: now };
    await db.items.put(next);
    return { item: next, previousUpdatedAt, undo: { kind: "delete", itemId, deletedAt: now } };
  });
}

async function undoReviewTag(item: Item, undo: Extract<UnsortedReviewUndo, { kind: "tag" | "remove-tag" }>) {
  if (item.deletedAt !== undefined) throw new Error("This item changed elsewhere. Restore it from Trash before undoing its tag.");
  if (item.updatedAt !== undo.updatedAt) throw new Error("This item has changed since the review action. Undo cannot safely change its tag assignment.");
  if (undo.kind === "tag") {
    item.tagIds = item.tagIds.filter(id => id !== undo.tagId);
  } else {
    if (item.tagIds.includes(undo.tagId)) throw new Error("This item's tag assignment changed elsewhere. Undo cannot safely restore the tag.");
    if (!await getDb().tags.get(undo.tagId)) throw new Error("This tag was deleted. Undo cannot restore its assignment.");
    item.tagIds.splice(undo.tagIndex, 0, undo.tagId);
  }
}

export async function undoUnsortedReviewAction(undo: UnsortedReviewUndo): Promise<UnsortedReviewMutation> {
  const db = getDb();
  return db.transaction("rw", db.items, db.collections, db.tags, async () => {
    const raw = await db.items.get(undo.itemId);
    if (!raw) throw new Error("This item no longer exists. Its review action cannot be undone.");
    const item = normalizeItem(raw);
    if (undo.kind === "file") {
      const collection = await db.collections.get(undo.collectionId);
      if (item.deletedAt !== undefined || item.collectionIds.length !== 1 || item.collectionIds[0] !== undo.collectionId || item.collectionAddedAt !== undo.collectionAddedAt || (collection && normalizeCollection(collection).pinnedItemIds.includes(item.id))) {
        throw new Error("This item's organization changed elsewhere. Undo would replace that change.");
      }
      item.collectionIds = [];
      if (undo.previousCollectionAddedAt === undefined) delete item.collectionAddedAt;
      else item.collectionAddedAt = undo.previousCollectionAddedAt;
    } else if (undo.kind === "tag" || undo.kind === "remove-tag") {
      await undoReviewTag(item, undo);
    } else {
      if (item.deletedAt !== undo.deletedAt) throw new Error("This item's Trash state changed elsewhere. Undo would replace that change.");
      delete item.deletedAt;
    }
    const previousUpdatedAt = item.updatedAt;
    const next = { ...item, updatedAt: Math.max(Date.now(), item.updatedAt + 1) };
    await db.items.put(next);
    return { item: next, previousUpdatedAt };
  });
}
