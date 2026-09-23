import { beforeEach, describe, expect, test } from "vitest";
import { deleteKeepallDatabase } from "./db";
import { createLink, deleteItem, listItems, updateLink } from "./items";
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

  test("keeps the extension's Markdown choice with a new or added note", async () => {
    const existing = await createLink({ url: "https://example.com/existing" });
    await saveExtensionLink({
      captureId: "18b02a16-7d84-47a1-9379-45754101e8be",
      url: "https://example.com/existing",
      title: "Existing",
      noteContent: "## Read later",
      noteFormat: "markdown",
    });
    await saveExtensionLink({
      captureId: "91efdbde-31eb-4c02-a60d-22f82a0d079e",
      url: "https://example.com/new",
      title: "New",
      noteContent: "**Important**",
      noteFormat: "markdown",
    });
    expect(await listItems()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: existing.id, noteContent: "## Read later", noteFormat: "markdown" }),
      expect.objectContaining({ url: "https://example.com/new", noteContent: "**Important**", noteFormat: "markdown" }),
    ]));
  });

  test("updates the format of an identical existing note", async () => {
    const existing = await createLink({ url: "https://example.com/existing-note", noteContent: "## Read later" });

    expect(await saveExtensionLink({
      captureId: "30fd80f5-05ce-419a-9ca1-b388f8ae4d12",
      url: existing.url,
      title: existing.title,
      noteContent: "## Read later",
      noteFormat: "markdown",
    })).toMatchObject({ itemId: existing.id, outcome: "updated" });
    expect(await listItems()).toEqual([expect.objectContaining({
      id: existing.id, noteContent: "## Read later", noteFormat: "markdown",
    })]);

    expect(await saveExtensionLink({
      captureId: "6c358069-f785-4136-bdf9-2b6a9aec2c66",
      url: existing.url,
      title: existing.title,
      noteContent: "## Read later",
      noteFormat: "plain",
    })).toMatchObject({ itemId: existing.id, outcome: "updated" });
    expect((await listItems())[0]).toEqual(expect.objectContaining({ noteFormat: undefined }));
  });

  test("loads and edits a saved link's title, note, and format", async () => {
    const existing = await createLink({
      url: "https://example.com/saved",
      title: "Saved title",
      noteContent: "# Original note",
      noteFormat: "markdown",
    });
    const options = await getExtensionOrganizationOptions(existing.url);
    expect(options.existingLink).toEqual({
      id: existing.id,
      title: "Saved title",
      noteContent: "# Original note",
      noteFormat: "markdown",
      collectionIds: [],
      tagIds: [],
    });

    expect(await saveExtensionLink({
      captureId: "5d9855c7-0591-43bb-ae96-8f2fbd5effdd",
      url: existing.url,
      title: "Edited title",
      noteContent: "A revised plain note",
      noteFormat: "plain",
      existingLink: options.existingLink,
    })).toMatchObject({ itemId: existing.id, outcome: "updated" });
    expect(await listItems()).toEqual([expect.objectContaining({
      id: existing.id,
      title: "Edited title",
      noteContent: "A revised plain note",
      noteFormat: undefined,
    })]);
  });

  test("clears a saved note only from a current editor snapshot", async () => {
    const existing = await createLink({ url: "https://example.com/clear-note", noteContent: "Keep this note" });
    const options = await getExtensionOrganizationOptions(existing.url);
    expect(await saveExtensionLink({
      captureId: "6eb643b1-f4d7-42aa-a1bd-1eb4bbdfeec8",
      url: existing.url,
      title: existing.title,
      noteContent: "",
      noteFormat: "plain",
      existingLink: options.existingLink,
    })).toMatchObject({ outcome: "updated" });
    expect((await listItems())[0]).toEqual(expect.objectContaining({ noteContent: undefined }));
  });

  test("rejects a stale editor snapshot without overwriting a newer note", async () => {
    const existing = await createLink({ url: "https://example.com/stale", noteContent: "Original" });
    const options = await getExtensionOrganizationOptions(existing.url);
    await updateLink(existing.id, { url: existing.url, noteContent: "Changed in Keepall" });

    await expect(saveExtensionLink({
      captureId: "bfeb95bc-7e0e-4a54-91f1-49fd3b244c7b",
      url: existing.url,
      title: existing.title,
      noteContent: "Extension edit",
      noteFormat: "markdown",
      existingLink: options.existingLink,
    })).rejects.toThrow("changed in Keepall");
    expect((await listItems())[0]).toEqual(expect.objectContaining({ noteContent: "Changed in Keepall" }));
  });

  test("rejects a drawer edit after the link's collection changes in Keepall", async () => {
    const first = await createCollection({ name: "First" });
    const second = await createCollection({ name: "Second" });
    const existing = await createLink({ url: "https://example.com/moved-while-open", noteContent: "Original" });
    await saveExtensionLink({
      captureId: "a417adbe-87c6-4356-9c1a-b4183d68d67a",
      url: existing.url,
      title: existing.title,
      collectionId: first.id,
    });
    const options = await getExtensionOrganizationOptions(existing.url);
    await saveExtensionLink({
      captureId: "bb554ee9-9cdb-42cf-b74d-56210455e9c9",
      url: existing.url,
      title: existing.title,
      collectionId: second.id,
    });

    await expect(saveExtensionLink({
      captureId: "736491b3-8f31-4286-8b1c-845e230f5a6d",
      url: existing.url,
      title: "Edited title",
      noteContent: "Original",
      noteFormat: "plain",
      collectionId: first.id,
      existingLink: options.existingLink,
    })).rejects.toThrow("changed in Keepall");
    expect((await listItems())[0]).toEqual(expect.objectContaining({ collectionIds: [second.id] }));
  });

  test("does not recreate a saved link that was deleted after the editor opened", async () => {
    const existing = await createLink({ url: "https://example.com/deleted", noteContent: "Original" });
    const options = await getExtensionOrganizationOptions(existing.url);
    await deleteItem(existing.id);

    await expect(saveExtensionLink({
      captureId: "e3f365f9-b43c-43ad-896d-660e12160caf",
      url: existing.url,
      title: existing.title,
      noteContent: "Edited",
      noteFormat: "plain",
      existingLink: options.existingLink,
    })).rejects.toThrow("changed in Keepall");
    expect(await listItems()).toEqual([]);
  });

  test("does not let extension edits remove local note images", async () => {
    const existing = await createLink({
      url: "https://example.com/image-note",
      noteContent: "Keep image\n\n![Image](keepall-image:asset_1)",
    });
    const options = await getExtensionOrganizationOptions(existing.url);
    expect(options.existingNoteHasImages).toBe(true);
    expect(await saveExtensionLink({
      captureId: "02851bd2-55bc-4a11-8283-17a2112006ef",
      url: existing.url,
      title: existing.title,
    })).toMatchObject({ outcome: "unchanged" });

    await expect(saveExtensionLink({
      captureId: "46486459-0147-427f-8023-ab266611376c",
      url: existing.url,
      title: existing.title,
      noteContent: "Removed image",
      noteFormat: "plain",
      existingLink: options.existingLink,
    })).rejects.toThrow("image");
    expect((await listItems())[0]).toEqual(expect.objectContaining({ noteContent: existing.noteContent }));
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
