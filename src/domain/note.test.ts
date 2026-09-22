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
      tagIds: [],
      collectionIds: [],
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

  test("keeps Markdown source and marks only opted-in notes", () => {
    const source = "# Card study\n\n- [ ] Compare corners";
    const markdown = buildNote(
      { content: source, format: "markdown" },
      { id: "n-md", now: 1 },
    );
    const plain = buildNote({ content: source }, { id: "n-plain", now: 1 });

    expect(markdown.content).toBe(source);
    expect(markdown.format).toBe("markdown");
    expect(plain).not.toHaveProperty("format");
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

  test("changes format without changing the note identity", () => {
    const plain = buildNote({ content: "# Study" }, { id: "n1", now: 1 });
    const markdown = applyNoteEdit(
      plain,
      { content: "# Study", format: "markdown" },
      { now: 2 },
    );
    const returnedToPlain = applyNoteEdit(
      markdown,
      { content: "# Study", format: "plain" },
      { now: 3 },
    );

    expect(markdown).toMatchObject({ id: "n1", format: "markdown", updatedAt: 2 });
    expect(returnedToPlain.id).toBe("n1");
    expect(returnedToPlain).not.toHaveProperty("format");
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
