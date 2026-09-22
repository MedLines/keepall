import { describe, expect, test } from "vitest";
import { buildNote, noteListTitle, noteReadingBody, applyNoteEdit, NoteValidationError } from "./note";

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
  test("keeps a leading code fence in the reading body when no title can be inferred", () => {
    const note = buildNote({ content: "```tsx\nconst card = true;\n```", format: "markdown" });
    expect(noteListTitle(note)).toBe("Untitled note");
    expect(noteReadingBody(note)).toBe(note.content);
  });
  test("uses the first plain-text line when the title is empty", () => {
    const note = buildNote({ content: "body" }, { id: "n1", now: 1 });
    expect(noteListTitle(note)).toBe("body");
  });

  test("uses a Markdown heading instead of showing Untitled", () => {
    const note = buildNote({ content: "# Image card redesign\n\nThe image should lead.", format: "markdown" });
    expect(noteListTitle(note)).toBe("Image card redesign");
  });

  test("keeps long first lines short enough for cards and lists", () => {
    const note = buildNote({ content: "A long observation about how the image card should behave when the library gets crowded and the viewport narrows." });
    expect(noteListTitle(note).length).toBeLessThanOrEqual(64);
    expect(noteListTitle(note)).toMatch(/…$/);
  });

  test("returns the title when one exists", () => {
    const note = buildNote(
      { title: "Sketch", content: "body" },
      { id: "n2", now: 1 },
    );
    expect(noteListTitle(note)).toBe("Sketch");
  });
});
