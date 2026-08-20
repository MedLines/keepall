import { beforeEach, describe, expect, test } from "vitest";
import { TagValidationError } from "@/domain/tag";
import { deleteKeepallDatabase, getDb } from "./db";
import { assignTagToItem, createNote, listItems } from "./items";
import { createTag, listTags } from "./tags";

describe("tags persistence", () => {
  beforeEach(async () => {
    await deleteKeepallDatabase();
  });

  test("createTag stores a tag that listTags returns", async () => {
    const created = await createTag({ name: "  design  " });

    expect(created.name).toBe("design");
    expect(await listTags()).toEqual([created]);
  });

  test("createTag reuses an existing name instead of duplicating", async () => {
    const first = await createTag({ name: "design" });
    const second = await createTag({ name: "design" });

    expect(second).toEqual(first);
    expect(await listTags()).toHaveLength(1);
  });

  test("createTag rejects an empty name", async () => {
    await expect(createTag({ name: "   " })).rejects.toBeInstanceOf(
      TagValidationError,
    );
    expect(await listTags()).toEqual([]);
  });

  test("assignTagToItem attaches a tag id and survives listItems", async () => {
    const note = await createNote({ content: "tagged note" });
    const tag = await createTag({ name: "inspiration" });

    const updated = await assignTagToItem(note.id, tag.id);

    expect(updated.tagIds).toEqual([tag.id]);
    expect(await listItems()).toEqual([updated]);
  });

  test("listItems treats missing tagIds as an empty array", async () => {
    await getDb().items.add({
      id: "legacy",
      type: "note",
      title: "",
      content: "old row",
      createdAt: 1,
      updatedAt: 1,
    } as never);

    const [item] = await listItems();

    expect(item?.tagIds).toEqual([]);
    expect(item?.collectionIds).toEqual([]);
  });
});
