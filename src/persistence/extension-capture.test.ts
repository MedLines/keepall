import { beforeEach, describe, expect, test } from "vitest";
import { deleteKeepallDatabase } from "./db";
import { createLink, listItems } from "./items";
import { createCollection, listCollections } from "./collections";
import { createTag, listTags } from "./tags";
import { getExtensionOrganizationOptions, saveExtensionLink } from "./extension-capture";

beforeEach(async () => {
  await deleteKeepallDatabase();
});

describe("saveExtensionLink", () => {
  test("saves the page once across repeated and concurrent requests", async () => {
    const input = {
      captureId: "7d5c52cb-8ac1-45eb-9f3a-31582189d22a",
      url: "https://example.com/article",
      title: "An article",
    };

    const results = await Promise.all([
      saveExtensionLink(input),
      saveExtensionLink({ ...input, captureId: "57733a7e-3f0e-4d75-a2f1-c806d339ff29" }),
    ]);

    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(await listItems()).toHaveLength(1);
    expect(await saveExtensionLink(input)).toMatchObject({ outcome: "unchanged" });
  });

  test("reuses a library link and fills an empty personal note", async () => {
    const existing = await createLink({ url: "https://example.com/article" });

    const result = await saveExtensionLink({
      captureId: "c2666ffd-8bda-4c85-81cc-78548517ef4b",
      url: "https://example.com/article",
      title: "Article title",
      noteContent: "Read for layout ideas",
    });

    expect(result).toEqual({ itemId: existing.id, created: false, outcome: "updated" });
    expect(await listItems()).toEqual([
      expect.objectContaining({
        id: existing.id,
        title: "Article title",
        noteContent: "Read for layout ideas",
      }),
    ]);
  });

  test("preserves an existing note and rejects a conflicting one", async () => {
    await createLink({ url: "https://example.com", noteContent: "First note" });

    await expect(saveExtensionLink({
      captureId: "d09a1c94-4573-4a95-b036-a6857b679682",
      url: "https://example.com",
      title: "Example",
      noteContent: "Different note",
    })).rejects.toThrow("already has a personal note");
    expect(await listItems()).toHaveLength(1);
  });

  test("rejects invalid URLs without writing", async () => {
    await expect(saveExtensionLink({
      captureId: "39ca3cc7-a9cc-4b23-a231-8c39600a776f",
      url: "javascript:alert(1)",
      title: "Bad",
    })).rejects.toThrow();
    expect(await listItems()).toHaveLength(0);
  });

  test("lists existing organization and saves a new link into selected collection and tags", async () => {
    const collection = await createCollection({ name: "Reading" });
    const tag = await createTag({ name: "Design" });
    const url = "https://example.com/organized";

    expect(await getExtensionOrganizationOptions(url)).toEqual({
      collections: [{ id: collection.id, name: "Reading" }],
      tags: [{ id: tag.id, name: "Design" }],
      collectionId: null,
      tagIds: [],
    });

    await saveExtensionLink({
      captureId: "4bd8d64e-3b70-4554-b5d5-c041a72453a0",
      url,
      title: "Organized link",
      collectionId: collection.id,
      tagIds: [tag.id],
    });

    expect(await getExtensionOrganizationOptions(url)).toMatchObject({
      collectionId: collection.id,
      tagIds: [tag.id],
    });
    expect(await listItems()).toEqual([expect.objectContaining({
      collectionIds: [collection.id],
      tagIds: [tag.id],
    })]);
  });

  test("editor selection can move a reused link while one click preserves its organization", async () => {
    const reading = await createCollection({ name: "Reading" });
    const later = await createCollection({ name: "Later" });
    const design = await createTag({ name: "Design" });
    const work = await createTag({ name: "Work" });
    const url = "https://example.com/reuse";
    await saveExtensionLink({
      captureId: "3d4e463c-0b06-46d5-86d7-d054e6fba201",
      url, title: "Reuse", collectionId: reading.id, tagIds: [design.id],
    });
    expect(await saveExtensionLink({
      captureId: "3d4e463c-0b06-46d5-86d7-d054e6fba202",
      url, title: "Reuse", collectionId: later.id, tagIds: [work.id],
    })).toMatchObject({ outcome: "updated" });
    expect(await saveExtensionLink({
      captureId: "3d4e463c-0b06-46d5-86d7-d054e6fba203",
      url, title: "Reuse",
    })).toMatchObject({ outcome: "unchanged" });

    expect(await listItems()).toEqual([expect.objectContaining({
      collectionIds: [later.id], tagIds: [work.id],
    })]);
  });

  test("reports a collection-only move by name and then no change", async () => {
    const reading = await createCollection({ name: "Reading" });
    const later = await createCollection({ name: "Later" });
    const url = "https://example.com/move";
    await saveExtensionLink({
      captureId: "486232f0-6c26-483c-8379-d9723193a873",
      url, title: "Move", collectionId: reading.id,
    });

    expect(await saveExtensionLink({
      captureId: "486232f0-6c26-483c-8379-d9723193a874",
      url, title: "Move", collectionId: later.id,
    })).toMatchObject({ outcome: "updated", movedTo: "Later" });
    expect(await saveExtensionLink({
      captureId: "486232f0-6c26-483c-8379-d9723193a875",
      url, title: "Move", collectionId: later.id,
    })).toMatchObject({ outcome: "unchanged" });
    expect(await saveExtensionLink({
      captureId: "486232f0-6c26-483c-8379-d9723193a876",
      url, title: "Move", collectionId: null,
    })).toMatchObject({ outcome: "updated", movedTo: "Unsorted" });
  });

  test("choosing Unsorted and no tags clears a reused link's organization", async () => {
    const collection = await createCollection({ name: "Reading" });
    const tag = await createTag({ name: "Design" });
    const url = "https://example.com/clear";
    await saveExtensionLink({
      captureId: "cf56b469-633a-4468-8767-4649a99fba25",
      url, title: "Clear", collectionId: collection.id, tagIds: [tag.id],
    });
    expect(await saveExtensionLink({
      captureId: "cf56b469-633a-4468-8767-4649a99fba26",
      url, title: "Clear", collectionId: null, tagIds: [],
    })).toMatchObject({ outcome: "updated" });

    expect(await listItems()).toEqual([expect.objectContaining({
      collectionIds: [], tagIds: [],
    })]);
  });

  test("rejects deleted organization choices without writing", async () => {
    await expect(saveExtensionLink({
      captureId: "720b337d-4137-4099-a858-220ced965540",
      url: "https://example.com/missing",
      title: "Missing",
      collectionId: "missing",
    })).rejects.toThrow("collection is no longer available");
    expect(await listItems()).toHaveLength(0);
  });

  test("creates typed collection and tag choices with the link", async () => {
    const existingTag = await createTag({ name: "Design" });
    const capture = {
      captureId: "993dc21b-32a4-4436-bfe5-bfc2568d498d",
      url: "https://example.com/new-organization",
      title: "New organization",
      collectionId: null,
      collectionName: "  Reading  ",
      tagIds: [existingTag.id],
      tagNames: ["  Research  ", "Research"],
    };

    await saveExtensionLink(capture);
    await saveExtensionLink(capture);

    const collections = await listCollections();
    const tags = await listTags();
    expect(collections.map((entry) => entry.name)).toEqual(["Reading"]);
    expect(tags.map((entry) => entry.name).sort()).toEqual(["Design", "Research"]);
    expect(await listItems()).toEqual([expect.objectContaining({
      collectionIds: [collections[0].id],
      tagIds: [existingTag.id, tags.find((entry) => entry.name === "Research")?.id],
    })]);
  });

  test("rolls back typed organization when an existing note conflicts", async () => {
    await createLink({ url: "https://example.com/conflict", noteContent: "Original" });

    await expect(saveExtensionLink({
      captureId: "d25ce29a-6db1-4dba-b74f-eb8a92fcfa0a",
      url: "https://example.com/conflict",
      title: "Conflict",
      noteContent: "Replacement",
      collectionName: "Temporary collection",
      tagNames: ["Temporary tag"],
    })).rejects.toThrow("already has a personal note");

    expect(await listCollections()).toEqual([]);
    expect(await listTags()).toEqual([]);
  });
});
