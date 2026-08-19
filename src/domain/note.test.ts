import { describe, expect, test } from "vitest";
import { buildNote, noteListTitle, applyNoteEdit, NoteValidationError } from "./note";

describe("buildNote", () => {
  test("creates a note with trimmed content and an empty title", () => {
    const note = buildNote(
      { content: "  hello world  " },
      { id: "note-1", now: 1000 },
    );

    expect(note).toEqual({
      id: "note-1",
      type: "note",
      title: "",
      content: "hello world",
      createdAt: 1000,
      updatedAt: 1000,
    });
  });

  test("trims the title when one is provided", () => {
    const note = buildNote(
      { title: "  Draft  ", content: "body" },
      { id: "note-2", now: 2000 },
    );

    expect(note.title).toBe("Draft");
  });

  test("rejects content that is empty after trimming", () => {
    expect(() => buildNote({ content: "   " })).toThrow(NoteValidationError);
    expect(() => buildNote({ content: "   " })).toThrow(
      "Note content is required",
    );
  });
});

describe("applyNoteEdit", () => {
  test("keeps id and createdAt and updates content and updatedAt", () => {
    const note = buildNote({ content: "old" }, { id: "n1", now: 1000 });

    expect(applyNoteEdit(note, { content: "  new body  " }, { now: 2000 })).toEqual({
      ...note,
      content: "new body",
      updatedAt: 2000,
    });
  });

  test("rejects empty content", () => {
    const note = buildNote({ content: "old" }, { id: "n1", now: 1 });
    expect(() => applyNoteEdit(note, { content: "   " })).toThrow(
      NoteValidationError,
    );
  });
});

describe("noteListTitle", () => {
  test("returns Untitled when the title is empty", () => {
    const note = buildNote({ content: "body" }, { id: "n1", now: 1 });
    expect(noteListTitle(note)).toBe("Untitled");
  });

  test("returns the title when one exists", () => {
    const note = buildNote(
      { title: "Sketch", content: "body" },
      { id: "n2", now: 1 },
    );
    expect(noteListTitle(note)).toBe("Sketch");
  });
});
