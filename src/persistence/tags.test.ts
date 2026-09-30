import { beforeEach, describe, expect, test } from "vitest";
import { TagValidationError } from "@/domain/tag";
import { deleteKeepallDatabase, getDb } from "./db";
import { assignTagToItem, createNote, listItems, unassignTagFromItem } from "./items";
import { createTag, deleteTag, deleteTags, listTags } from "./tags";

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

  test("unassignTagFromItem drops the id but leaves the tag in the library", async () => {
    const note = await createNote({ content: "tagged note" });
    const tag = await createTag({ name: "inspiration" });
    await assignTagToItem(note.id, tag.id);

    const updated = await unassignTagFromItem(note.id, tag.id);

    expect(updated.tagIds).toEqual([]);
    expect(await listTags()).toEqual([tag]);
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

  test("deleting a tag removes it from every item and the tags table", async () => {
    const tag = await createTag({ name: "obsolete" });
    const note = await createNote({ content: "Tagged note" });
    await assignTagToItem(note.id, tag.id);

    await deleteTag(tag.id);

    expect(await listTags()).toEqual([]);
    expect((await listItems())[0]?.tagIds).toEqual([]);
  });
  test("bulk deletion removes selected tags from active and trashed items while retaining other tags", async () => {
    const first = await createTag({ name: "first" });
    const second = await createTag({ name: "second" });
    const keep = await createTag({ name: "keep" });
    const active = await createNote({ content: "Active" });
    const trashed = await createNote({ content: "Trashed" });
    await getDb().items.update(active.id, { tagIds: [first.id, second.id, keep.id] });
    await getDb().items.update(trashed.id, { tagIds: [second.id], deletedAt: 10 });

    await deleteTags([first.id, second.id, first.id]);

    expect(await listTags()).toEqual([keep]);
    expect((await getDb().items.get(active.id))?.tagIds).toEqual([keep.id]);
    expect(await getDb().items.get(trashed.id)).toMatchObject({ tagIds: [], deletedAt: 10 });
    expect(await getDb().items.count()).toBe(2);
  });

  test("bulk deletion with a missing tag leaves all memberships intact", async () => {
    const tag = await createTag({ name: "keep" });
    const note = await createNote({ content: "Keep" });
    await assignTagToItem(note.id, tag.id);

    await expect(deleteTags([tag.id, "missing"])).rejects.toThrow("Tag not found");

    expect(await listTags()).toEqual([tag]);
    expect((await getDb().items.get(note.id))?.tagIds).toEqual([tag.id]);
  });

});
