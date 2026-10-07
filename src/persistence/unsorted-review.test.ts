import { afterEach, expect, test, vi } from "vitest";
import { createNote, assignCollectionToItem } from "./items";
import { createCollection, deleteCollections } from "./collections";
import { createTag, deleteTags } from "./tags";
import { getDb } from "./db";
import { applyUnsortedReviewAction, undoUnsortedReviewAction, rebaseUnsortedReviewUndo } from "./unsorted-review";

afterEach(() => vi.restoreAllMocks());

test("filing undo preserves concurrent note edits and tags", async () => {
  const item = await createNote({ content: "Original" });
  await getDb().items.update(item.id, { collectionAddedAt: 11 });
  const collection = await createCollection({ name: "Reading" });
  const result = await applyUnsortedReviewAction(item.id, { kind: "file", collectionId: collection.id });
  await getDb().items.update(item.id, { title: "Edited elsewhere", tagIds: ["other-tag"] });
  const { item: restored } = await undoUnsortedReviewAction(result.undo!);
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
  expect((await undoUnsortedReviewAction(result.undo!)).item).toMatchObject({ collectionIds: [], tagIds: [] });
});
test("delete undo restores the row while preserving concurrent content edits", async () => {
  const item = await createNote({ content: "Deleted" });
  const result = await applyUnsortedReviewAction(item.id, { kind: "delete" });
  expect(result.item.deletedAt).toBeDefined();
  await getDb().items.update(item.id, { title: "Changed while in Trash" });
  const { item: restored } = await undoUnsortedReviewAction(result.undo!);
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

test("filing Undo supports legacy collections without pinned item IDs", async () => {
  const item = await createNote({ content: "Legacy collection" });
  await getDb().collections.put({ id: "legacy", name: "Legacy", createdAt: 1 } as never);
  const result = await applyUnsortedReviewAction(item.id, { kind: "file", collectionId: "legacy" });
  expect((await undoUnsortedReviewAction(result.undo!)).item).toMatchObject({ collectionIds: [] });
});

test("tag Undo refuses a later remove and reassignment even with a frozen clock", async () => {
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const item = await createNote({ content: "Reassigned tag" });
  const tag = await createTag({ name: "Reassigned" });
  const result = await applyUnsortedReviewAction(item.id, { kind: "tag", tagId: tag.id });
  const assignedAt = result.item.updatedAt;
  await getDb().items.update(item.id, { tagIds: [], updatedAt: assignedAt + 1 });
  await getDb().items.update(item.id, { tagIds: [tag.id], updatedAt: assignedAt + 2 });
  await expect(undoUnsortedReviewAction(result.undo!)).rejects.toThrow(/changed since/);
  expect(await getDb().items.get(item.id)).toMatchObject({ tagIds: [tag.id] });
});

test("tag Undo conservatively preserves later content and unrelated tag edits", async () => {
  const item = await createNote({ content: "Original text" });
  const tag = await createTag({ name: "Owned tag" });
  const result = await applyUnsortedReviewAction(item.id, { kind: "tag", tagId: tag.id });
  await getDb().items.update(item.id, { title: "Edited elsewhere", tagIds: [tag.id, "other"], updatedAt: result.item.updatedAt + 1 });
  await expect(undoUnsortedReviewAction(result.undo!)).rejects.toThrow(/changed since/);
  expect(await getDb().items.get(item.id)).toMatchObject({ title: "Edited elsewhere", tagIds: [tag.id, "other"] });
});

test("known review actions rebase older tag Undo without reviving stale ownership", async () => {
  const item = await createNote({ content: "Two tags" });
  const first = await createTag({ name: "First tag" });
  const second = await createTag({ name: "Second tag" });
  const firstAction = await applyUnsortedReviewAction(item.id, { kind: "tag", tagId: first.id });
  const secondAction = await applyUnsortedReviewAction(item.id, { kind: "tag", tagId: second.id });
  const olderUndo = rebaseUnsortedReviewUndo(firstAction.undo!, secondAction);
  const latestUndo = await undoUnsortedReviewAction(secondAction.undo!);
  const result = await undoUnsortedReviewAction(rebaseUnsortedReviewUndo(olderUndo, latestUndo));
  expect(result.item.tagIds).toEqual([]);

  const added = await applyUnsortedReviewAction(item.id, { kind: "tag", tagId: first.id });
  await getDb().items.update(item.id, { updatedAt: added.item.updatedAt + 1, title: "External edit" });
  const later = await applyUnsortedReviewAction(item.id, { kind: "tag", tagId: second.id });
  await expect(undoUnsortedReviewAction(rebaseUnsortedReviewUndo(added.undo!, later))).rejects.toThrow(/changed since/);
  expect((await getDb().items.get(item.id))?.tagIds).toEqual([first.id, second.id]);
});

test.each(["tag", "collection"])("deleting a %s keeps item timestamps monotonic with a frozen clock", async kind => {
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const item = await createNote({ content: "Future marker" });
  const tag = await createTag({ name: "Deleted tag" });
  const collection = await createCollection({ name: "Deleted collection" });
  await getDb().items.update(item.id, { tagIds: [tag.id], collectionIds: [collection.id], updatedAt: 2000 });
  if (kind === "tag") await deleteTags([tag.id]);
  else await deleteCollections([collection.id]);
  expect((await getDb().items.get(item.id))?.updatedAt).toBe(2001);
});

test("file and its Undo rebase an older tag only across known review edits", async () => {
  const item = await createNote({ content: "File chain" });
  const tag = await createTag({ name: "Chain tag" });
  const collection = await createCollection({ name: "Chain collection" });
  const tagged = await applyUnsortedReviewAction(item.id, { kind: "tag", tagId: tag.id });
  const filed = await applyUnsortedReviewAction(item.id, { kind: "file", collectionId: collection.id });
  const olderUndo = rebaseUnsortedReviewUndo(tagged.undo!, filed);
  const restored = await undoUnsortedReviewAction(filed.undo!);
  const untagged = await undoUnsortedReviewAction(rebaseUnsortedReviewUndo(olderUndo, restored));
  expect(untagged.item).toMatchObject({ tagIds: [], collectionIds: [] });
});
