import { beforeEach, describe, expect, test } from "vitest";
import { deleteKeepallDatabase } from "./db";
import { createLink, listItems } from "./items";
import { saveExtensionLink } from "./extension-capture";

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
    expect((await saveExtensionLink(input)).created).toBe(false);
  });

  test("reuses a library link and fills an empty personal note", async () => {
    const existing = await createLink({ url: "https://example.com/article" });

    const result = await saveExtensionLink({
      captureId: "c2666ffd-8bda-4c85-81cc-78548517ef4b",
      url: "https://example.com/article",
      title: "Article title",
      noteContent: "Read for layout ideas",
    });

    expect(result).toEqual({ itemId: existing.id, created: false });
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
});
