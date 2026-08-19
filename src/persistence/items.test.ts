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

  test("createLink does not write javascript URLs", async () => {
    await expect(
      createLink({ url: "javascript:alert(1)" }),
    ).rejects.toBeInstanceOf(LinkValidationError);
    expect(await listItems()).toEqual([]);
  });
});
