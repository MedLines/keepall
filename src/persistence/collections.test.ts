import { beforeEach, describe, expect, test, vi } from "vitest";
import { CollectionValidationError } from "@/domain/collection";
import { deleteKeepallDatabase, getDb } from "./db";
import { assignCollectionToItem, createNote, listItems, updateNote } from "./items";
import {
  createCollection,
  deleteCollection,
  deleteCollections,
  listCollections,
  pinItemInCollection,
  renameCollection,
  unpinItemInCollection,
} from "./collections";

describe("collections persistence", () => {
  beforeEach(async () => {
    await deleteKeepallDatabase();
  });

  test("createCollection stores a collection that listCollections returns", async () => {
    const created = await createCollection({ name: "  Reading  " });

    expect(created.name).toBe("Reading");
    expect(await listCollections()).toEqual([created]);
  });

  test("createCollection reuses an existing name instead of duplicating", async () => {
    const first = await createCollection({ name: "Reading" });
    const second = await createCollection({ name: "Reading" });

    expect(second).toEqual(first);
    expect(await listCollections()).toHaveLength(1);
  });

  test("createCollection rejects an empty name", async () => {
    await expect(createCollection({ name: "   " })).rejects.toBeInstanceOf(
      CollectionValidationError,
    );
    expect(await listCollections()).toEqual([]);
  });

  test("assignCollectionToItem moves exclusive membership", async () => {
    const note = await createNote({ content: "collected note" });
    const reading = await createCollection({ name: "Reading" });
    const later = await createCollection({ name: "Later" });

    await assignCollectionToItem(note.id, reading.id);
    const updated = await assignCollectionToItem(note.id, later.id);

    expect(updated.collectionIds).toEqual([later.id]);
    expect(await listItems()).toEqual([updated]);
  });

  test("collection addition time changes on moves but stays stable on edits and reassignment", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(10);
    try {
      const note = await createNote({ content: "old note" });
      const reading = await createCollection({ name: "Reading" });
      const later = await createCollection({ name: "Later" });
      clock.mockReturnValue(20);
      expect((await assignCollectionToItem(note.id, reading.id)).collectionAddedAt).toBe(20);
      clock.mockReturnValue(30);
      await updateNote(note.id, { content: "edited" });
      expect((await listItems())[0].collectionAddedAt).toBe(20);
      expect((await assignCollectionToItem(note.id, reading.id)).collectionAddedAt).toBe(20);
      clock.mockReturnValue(40);
      expect((await assignCollectionToItem(note.id, later.id)).collectionAddedAt).toBe(40);
    } finally {
      clock.mockRestore();
    }
  });

  test("listItems coerces multi collectionIds to the first id", async () => {
    const reading = await createCollection({ name: "Reading" });
    const later = await createCollection({ name: "Later" });
    await getDb().items.add({
      id: "legacy",
      type: "note",
      title: "",
      content: "old row",
      tagIds: [],
      collectionIds: [reading.id, later.id],
      createdAt: 1,
      updatedAt: 1,
    } as never);

    const [item] = await listItems();

    expect(item?.collectionIds).toEqual([reading.id]);
  });

  test("listItems treats missing collectionIds as an empty array", async () => {
    await getDb().items.add({
      id: "legacy",
      type: "note",
      title: "",
      content: "old row",
      tagIds: [],
      createdAt: 1,
      updatedAt: 1,
    } as never);

    const [item] = await listItems();

    expect(item?.collectionIds).toEqual([]);
  });

  test("listCollections coerces missing pinnedItemIds", async () => {
    await getDb().collections.add({
      id: "c1",
      name: "Reading",
      createdAt: 1,
    } as never);

    expect(await listCollections()).toEqual([
      {
        id: "c1",
        name: "Reading",
        createdAt: 1,
        pinnedItemIds: [],
      },
    ]);
  });

  test("pin and unpin item ids on a collection", async () => {
    const note = await createNote({ content: "pinned note" });
    const collection = await createCollection({ name: "Reading" });
    await assignCollectionToItem(note.id, collection.id);

    const pinned = await pinItemInCollection(collection.id, note.id);
    expect(pinned.pinnedItemIds).toEqual([note.id]);

    const unpinned = await unpinItemInCollection(collection.id, note.id);
    expect(unpinned.pinnedItemIds).toEqual([]);
  });

  test("renameCollection updates the name", async () => {
    const created = await createCollection({ name: "Reading" });
    const renamed = await renameCollection(created.id, "  Later  ");
    expect(renamed.name).toBe("Later");
    expect(await listCollections()).toEqual([renamed]);
  });

  test("deleteCollection clears item membership and keeps the item", async () => {
    const note = await createNote({ content: "collected note" });
    const collection = await createCollection({ name: "Reading" });
    await assignCollectionToItem(note.id, collection.id);

    await deleteCollection(collection.id);

    expect(await listCollections()).toEqual([]);
    const [item] = await listItems();
    expect(item?.id).toBe(note.id);
    expect(item?.collectionIds).toEqual([]);
  });

  test("bulk deletion preserves active and trashed items and clears folder pins", async () => {
    const a = await createCollection({ name: "A" });
    const b = await createCollection({ name: "B" });
    const keep = await createCollection({ name: "Keep" });
    const first = await createNote({ content: "First" });
    const second = await createNote({ content: "Second" });
    await assignCollectionToItem(first.id, a.id);
    await assignCollectionToItem(second.id, b.id);
    await getDb().items.update(second.id, { deletedAt: 10 });
    await getDb().preferences.put({ id: "library", pinnedCollectionIds: [a.id, keep.id, b.id] });
    await deleteCollections([a.id, b.id, a.id]);
    expect(await listCollections()).toEqual([keep]);
    expect((await getDb().items.get(first.id))?.collectionIds).toEqual([]);
    expect(await getDb().items.get(second.id)).toMatchObject({ collectionIds: [], deletedAt: 10 });
    expect((await getDb().preferences.get("library"))?.pinnedCollectionIds).toEqual([keep.id]);
  });

  test("a missing folder cancels bulk deletion without changing any items", async () => {
    const collection = await createCollection({ name: "Reading" });
    const note = await createNote({ content: "Keep" });
    await assignCollectionToItem(note.id, collection.id);
    await expect(deleteCollections([collection.id, "missing"])).rejects.toThrow("Collection not found");
    expect(await listCollections()).toEqual([collection]);
    expect((await getDb().items.get(note.id))?.collectionIds).toEqual([collection.id]);
  });
});
