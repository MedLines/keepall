import { beforeEach, describe, expect, test } from "vitest";
import { LinkValidationError } from "@/domain/link";
import { buildNote, NoteValidationError } from "@/domain/note";
import { deleteKeepallDatabase, getDb } from "./db";
import {
  createLink,
  createNote,
  deleteItem,
  listItems,
  listNotes,
  saveLinkPreviewResult,
  setLinkPreviewPending,
  updateLink,
  updateNote,
} from "./items";

describe("items persistence", () => {
  beforeEach(async () => {
    await deleteKeepallDatabase();
  });

  test("createNote stores a note that listNotes returns", async () => {
    const created = await createNote({
      title: "Sketch",
      content: "A persisted note",
    });
    const listed = await listNotes();

    expect(listed).toEqual([created]);
    expect(created.type).toBe("note");
    expect(created.content).toBe("A persisted note");
  });

  test("listNotes returns newest first", async () => {
    await getDb().items.bulkAdd([
      buildNote({ content: "older" }, { id: "old", now: 1 }),
      buildNote({ content: "newer" }, { id: "new", now: 2 }),
    ]);

    expect((await listNotes()).map((note) => note.id)).toEqual(["new", "old"]);
  });

  test("createNote does not write when content is empty", async () => {
    await expect(createNote({ content: "   " })).rejects.toBeInstanceOf(
      NoteValidationError,
    );
    expect(await listNotes()).toEqual([]);
  });

  test("createLink stores a link that listItems returns with notes", async () => {
    const note = await createNote({ content: "a note" });
    const link = await createLink({ url: "https://example.com" });

    expect(await listItems()).toEqual([link, note]);
  });

  test("deleteItem removes one stored item and leaves the rest", async () => {
    const keep = await createNote({ content: "keep me" });
    const drop = await createNote({ content: "drop me" });

    await deleteItem(drop.id);

    expect(await listItems()).toEqual([keep]);
  });

  test("updateNote changes content and keeps id and createdAt", async () => {
    const created = await createNote({ content: "old body" });
    const updated = await updateNote(created.id, { content: "new body" });

    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.content).toBe("new body");
    expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
    expect(await listItems()).toEqual([updated]);
  });

  test("updateNote does not write empty content", async () => {
    const created = await createNote({ content: "keep" });
    await expect(updateNote(created.id, { content: "   " })).rejects.toBeInstanceOf(
      NoteValidationError,
    );
    expect(await listNotes()).toEqual([created]);
  });

  test("updateLink changes url and keeps id and createdAt", async () => {
    const created = await createLink({ url: "https://example.com/old" });
    const updated = await updateLink(created.id, {
      url: "https://example.com/new",
    });

    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.url).toBe("https://example.com/new");
    expect(await listItems()).toEqual([updated]);
  });

  test("updateLink does not write javascript URLs", async () => {
    const created = await createLink({ url: "https://example.com" });
    await expect(
      updateLink(created.id, { url: "javascript:alert(1)" }),
    ).rejects.toBeInstanceOf(LinkValidationError);
    expect(await listItems()).toEqual([created]);
  });

  test("createLink does not write javascript URLs", async () => {
    await expect(
      createLink({ url: "javascript:alert(1)" }),
    ).rejects.toBeInstanceOf(LinkValidationError);
    expect(await listItems()).toEqual([]);
  });

  test("setLinkPreviewPending and saveLinkPreviewResult update the link row", async () => {
    const created = await createLink({ url: "https://example.com" });
    const pending = await setLinkPreviewPending(created.id);
    expect(pending.previewStatus).toBe("pending");

    const ready = await saveLinkPreviewResult(created.id, {
      status: "ready",
      title: "Example",
      description: "Desc",
      imageUrl: "https://cdn.example.com/i.png",
    });
    expect(ready.previewStatus).toBe("ready");
    expect(ready.previewTitle).toBe("Example");
    expect(ready.previewImageUrl).toBe("https://cdn.example.com/i.png");

    const listed = await listItems();
    expect(listed[0]).toMatchObject({
      id: created.id,
      previewStatus: "ready",
      previewTitle: "Example",
    });
  });
});
