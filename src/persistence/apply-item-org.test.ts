import { beforeEach, describe, expect, test } from "vitest";
import { deleteKeepallDatabase } from "./db";
import { applyItemOrg } from "./apply-item-org";
import { createNote, listItems } from "./items";
import { listCollections } from "./collections";
import { listTags } from "./tags";

describe("applyItemOrg", () => {
  beforeEach(async () => {
    await deleteKeepallDatabase();
  });

  test("assigns tags and one collection on an existing item", async () => {
    const note = await createNote({ content: "captured" });

    await applyItemOrg(note.id, {
      tagNames: ["work", "later"],
      collectionName: "Reading",
    });

    const [item] = await listItems();
    const tags = await listTags();
    const collections = await listCollections();

    expect(tags.map((tag) => tag.name)).toEqual(["later", "work"]);
    expect(collections.map((collection) => collection.name)).toEqual([
      "Reading",
    ]);
    expect(item?.tagIds).toHaveLength(2);
    expect(item?.collectionIds).toEqual([collections[0]!.id]);
  });

  test("retrying the same org does not duplicate tag or collection ids", async () => {
    const note = await createNote({ content: "captured" });
    const org = { tagNames: ["work"], collectionName: "Reading" };

    await applyItemOrg(note.id, org);
    await applyItemOrg(note.id, org);

    const [item] = await listItems();
    expect(item?.tagIds).toHaveLength(1);
    expect(item?.collectionIds).toHaveLength(1);
    expect(await listTags()).toHaveLength(1);
    expect(await listCollections()).toHaveLength(1);
  });
});
