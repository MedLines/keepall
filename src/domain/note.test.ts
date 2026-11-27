import { describe, expect, test } from "vitest";
import { buildNote, noteListTitle, noteReadingBody, applyNoteEdit, NoteValidationError, noteImageAssetIds, noteImageMarkers, insertNoteImageMarker, removeNoteImageMarkerAt, replaceNoteImageAssetIds, toggleNoteTaskAt } from "./note";

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
  test("finds the title after an inline image and keeps the image in the reading body", () => {
    const note = buildNote({ content: "![Image](keepall-image:a1)\n\n# Spacing study\n\nKeep this.", format: "markdown" });
    expect(noteListTitle(note)).toBe("Spacing study");
    expect(noteReadingBody(note)).toContain("![Image](keepall-image:a1)");
    expect(noteReadingBody(note)).not.toContain("# Spacing study");
  });
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

describe("inline note images", () => {
  test("inserts an image between paragraphs and finds unique saved image references", () => {
    const content = insertNoteImageMarker("Before\n\nAfter", 8, 8, "a1");
    expect(content).toBe("Before\n\n![Image](keepall-image:a1)\n\nAfter");
    expect(noteImageAssetIds(`${content}\n\n![Image](keepall-image:a1)`)).toEqual(["a1"]);
    expect(noteImageAssetIds("![Remote](https://example.com/a.png)")).toEqual([]);
  });

  test("remaps temporary image references without changing other text", () => {
    expect(replaceNoteImageAssetIds("Before\n\n![Image](keepall-image:temp)\n\nAfter", new Map([["temp", "saved"]])))
      .toBe("Before\n\n![Image](keepall-image:saved)\n\nAfter");
  });

  test("removes an inline image without merging the surrounding paragraphs", () => {
    expect(removeNoteImageMarkerAt("Before\n\n![Image](keepall-image:a1)\n\nAfter", 0))
      .toBe("Before\n\nAfter");
    expect(removeNoteImageMarkerAt("![Image](keepall-image:a1)\n\nAfter", 0))
      .toBe("After");
    expect(removeNoteImageMarkerAt("Before\n\n![Image](keepall-image:a1)", 0))
      .toBe("Before");
    const repeated = "![Image](keepall-image:a1)\n\n![Image](keepall-image:a1)";
    expect(noteImageMarkers(repeated)).toHaveLength(2);
    expect(noteImageMarkers(removeNoteImageMarkerAt(repeated, 1))).toHaveLength(1);
  });
});

describe("toggleNoteTaskAt", () => {
  const at = (content: string, line: string) => content.indexOf(line);

  test("flips only the box on the item at the offset and keeps every other character", () => {
    const content = "# Plan\r\n\r\n- [ ] Milk  \r\n- [x] Bread [ ] not a box\r\n\ttrailing\r\n";
    expect(toggleNoteTaskAt(content, at(content, "- [ ] Milk"))).toBe("# Plan\r\n\r\n- [x] Milk  \r\n- [x] Bread [ ] not a box\r\n\ttrailing\r\n");
    expect(toggleNoteTaskAt(content, at(content, "- [x] Bread"))).toBe("# Plan\r\n\r\n- [ ] Milk  \r\n- [ ] Bread [ ] not a box\r\n\ttrailing\r\n");
  });

  test("clears done boxes written with x or X", () => {
    expect(toggleNoteTaskAt("- [x] Done", 0)).toBe("- [ ] Done");
    expect(toggleNoteTaskAt("- [X] Done", 0)).toBe("- [ ] Done");
    expect(toggleNoteTaskAt("- [ ] Open", 0)).toBe("- [x] Open");
  });

  test("handles every list marker, nested items, blockquotes and an offset at the line start", () => {
    const content = "* [ ] star\n+ [ ] plus\n1. [ ] one\n2) [ ] two\n- [ ] parent\n  - [X] child\n> - [ ] quoted\n-\n  [ ] next line";
    const flip = (line: string) => toggleNoteTaskAt(content, at(content, line));
    expect(flip("* [ ] star")).toBe(content.replace("* [ ] star", "* [x] star"));
    expect(flip("+ [ ] plus")).toBe(content.replace("+ [ ] plus", "+ [x] plus"));
    expect(flip("1. [ ] one")).toBe(content.replace("1. [ ] one", "1. [x] one"));
    expect(flip("2) [ ] two")).toBe(content.replace("2) [ ] two", "2) [x] two"));
    expect(flip("- [X] child")).toBe(content.replace("- [X] child", "- [ ] child"));
    expect(flip("  - [X] child")).toBe(content.replace("- [X] child", "- [ ] child"));
    expect(flip("- [ ] quoted")).toBe(content.replace("- [ ] quoted", "- [x] quoted"));
    expect(flip("> - [ ] quoted")).toBe(content.replace("- [ ] quoted", "- [x] quoted"));
    expect(flip("-\n  [ ] next line")).toBe(content.replace("[ ] next line", "[x] next line"));
    // A parent item's offset never reaches into its children.
    expect(flip("- [ ] parent")).toBe(content.replace("- [ ] parent", "- [x] parent"));
  });

  test("leaves non-task lines and out-of-range offsets alone", () => {
    for (const content of ["- plain item", "Text with [ ] inside", "- [ ]", "- [x]done", "- [y] other", "[ ] no marker", "-  \n\n  [ ] after a blank line"]) {
      expect(toggleNoteTaskAt(content, 0)).toBe(content);
    }
    const content = "- [ ] Milk";
    expect(toggleNoteTaskAt(content, 2)).toBe(content);
    expect(toggleNoteTaskAt(content, -1)).toBe(content);
    expect(toggleNoteTaskAt(content, content.length)).toBe(content);
    expect(toggleNoteTaskAt(content, 0.5)).toBe(content);
  });
});
