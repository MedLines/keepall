import { expect, test } from "vitest";
import { createNote, assignCollectionToItem } from "./items";
import { createCollection } from "./collections";
import { createTag } from "./tags";
import { getDb } from "./db";
import { applyUnsortedReviewAction, undoUnsortedReviewAction } from "./unsorted-review";

test("filing undo preserves concurrent note edits and tags", async () => {
  const item = await createNote({ content: "Original" });
  await getDb().items.update(item.id, { collectionAddedAt: 11 });
  const collection = await createCollection({ name: "Reading" });
  const result = await applyUnsortedReviewAction(item.id, { kind: "file", collectionId: collection.id });
  await getDb().items.update(item.id, { title: "Edited elsewhere", tagIds: ["other-tag"] });
  const restored = await undoUnsortedReviewAction(result.undo!);
  expect(restored).toMatchObject({ collectionIds: [], collectionAddedAt: 11, title: "Edited elsewhere", tagIds: ["other-tag"] });
});
test("filing undo refuses to replace a later collection change", async () => {
  const item = await createNote({ content: "Original" });
  const first = await createCollection({ name: "First" });
  const second = await createCollection({ name: "Second" });
  const result = await applyUnsortedReviewAction(item.id, { kind: "file", collectionId: first.id });
  await assignCollectionToItem(item.id, second.id);
  await expect(undoUnsortedReviewAction(result.undo!)).rejects.toThrow(/changed/);
  expect(await getDb().items.get(item.id)).toMatchObject({ collectionIds: [second.id] });
});
test("tag-only changes remain unsorted and undo removes only the added tag", async () => {
  const item = await createNote({ content: "Tagged" });
  const tag = await createTag({ name: "Reference" });
  const result = await applyUnsortedReviewAction(item.id, { kind: "tag", tagId: tag.id });
  expect(result.item).toMatchObject({ collectionIds: [], tagIds: [tag.id] });
  expect((await applyUnsortedReviewAction(item.id, { kind: "tag", tagId: tag.id })).undo).toBeNull();
  await getDb().items.update(item.id, { tagIds: [tag.id, "other"], title: "New title" });
  expect(await undoUnsortedReviewAction(result.undo!)).toMatchObject({ collectionIds: [], tagIds: ["other"], title: "New title" });
});
test("delete undo restores the row while preserving concurrent content edits", async () => {
  const item = await createNote({ content: "Deleted" });
  const result = await applyUnsortedReviewAction(item.id, { kind: "delete" });
  expect(result.item.deletedAt).toBeDefined();
  await getDb().items.update(item.id, { title: "Changed while in Trash" });
  const restored = await undoUnsortedReviewAction(result.undo!);
  expect(restored.deletedAt).toBeUndefined();
  expect(restored.title).toBe("Changed while in Trash");
});
test("stale review actions cannot file an item moved by another view", async () => {
  const item = await createNote({ content: "Moved" });
  const collection = await createCollection({ name: "Elsewhere" });
  await assignCollectionToItem(item.id, collection.id);
  await expect(applyUnsortedReviewAction(item.id, { kind: "delete" })).rejects.toThrow(/Unsorted/);
  expect((await getDb().items.get(item.id))?.deletedAt).toBeUndefined();
});

test("Undo refuses a later Trash state and a new collection pin", async () => {
  const deleted = await createNote({ content: "Trash race" });
  const removal = await applyUnsortedReviewAction(deleted.id, { kind: "delete" });
  await getDb().items.update(deleted.id, { deletedAt: deleted.createdAt + 1000 });
  await expect(undoUnsortedReviewAction(removal.undo!)).rejects.toThrow(/changed/);
  const filed = await createNote({ content: "Pin race" });
  const collection = await createCollection({ name: "Pinned" });
  const filing = await applyUnsortedReviewAction(filed.id, { kind: "file", collectionId: collection.id });
  await getDb().collections.update(collection.id, { pinnedItemIds: [filed.id] });
  await expect(undoUnsortedReviewAction(filing.undo!)).rejects.toThrow(/changed/);
});
