import { beforeEach, describe, expect, test } from "vitest";
import { CollectionValidationError } from "@/domain/collection";
import { deleteKeepallDatabase, getDb } from "./db";
import { assignCollectionToItem, createNote, listItems } from "./items";
import {
  createCollection,
  deleteCollection,
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
});
