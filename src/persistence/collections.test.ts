import { beforeEach, describe, expect, test } from "vitest";
import { CollectionValidationError } from "@/domain/collection";
import { deleteKeepallDatabase, getDb } from "./db";
import { assignCollectionToItem, createNote, listItems } from "./items";
import { createCollection, listCollections } from "./collections";

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

  test("assignCollectionToItem attaches an id and survives listItems", async () => {
    const note = await createNote({ content: "collected note" });
    const collection = await createCollection({ name: "Reading" });

    const updated = await assignCollectionToItem(note.id, collection.id);

    expect(updated.collectionIds).toEqual([collection.id]);
    expect(await listItems()).toEqual([updated]);
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
});
