import { beforeEach, describe, expect, test } from "vitest";
import { buildNote, NoteValidationError } from "@/domain/note";
import { deleteKeepallDatabase, getDb } from "./db";
import { createNote, listNotes } from "./notes";

describe("notes persistence", () => {
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
});
