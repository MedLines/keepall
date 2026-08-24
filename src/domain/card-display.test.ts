import { describe, expect, test } from "vitest";
import {
  cardInitial,
  cardSecondaryLine,
  linkCardHost,
  noteCardSnippet,
  NOTE_SNIPPET_MAX_LENGTH,
} from "./card-display";
import { buildLink } from "./link";
import { buildNote } from "./note";

describe("cardInitial", () => {
  test("uses the first letter of a note title", () => {
    const note = buildNote(
      { title: "recipes", content: "flour" },
      { id: "n1", now: 1 },
    );
    expect(cardInitial(note)).toBe("R");
  });

  test("uses U from Untitled when the note has no title", () => {
    const note = buildNote({ content: "flour" }, { id: "n1", now: 1 });
    expect(cardInitial(note)).toBe("U");
  });

  test("uses the hostname letter when a link has no title", () => {
    const link = buildLink(
      { url: "https://example.com/x" },
      { id: "l1", now: 1 },
    );
    expect(cardInitial(link)).toBe("E");
  });
});

describe("linkCardHost", () => {
  test("returns the URL hostname", () => {
    const link = buildLink(
      { url: "https://docs.example.com/path" },
      { id: "l1", now: 1 },
    );
    expect(linkCardHost(link)).toBe("docs.example.com");
  });
});

describe("noteCardSnippet", () => {
  test("returns short content unchanged", () => {
    const note = buildNote({ content: "short" }, { id: "n1", now: 1 });
    expect(noteCardSnippet(note)).toBe("short");
  });

  test("truncates long content with an ellipsis", () => {
    const note = buildNote(
      { content: "a".repeat(NOTE_SNIPPET_MAX_LENGTH + 5) },
      { id: "n1", now: 1 },
    );
    const snippet = noteCardSnippet(note);
    expect(snippet.endsWith("…")).toBe(true);
    expect(snippet.length).toBe(NOTE_SNIPPET_MAX_LENGTH + 1);
  });
});

describe("cardSecondaryLine", () => {
  test("uses host for links and snippet for notes", () => {
    const link = buildLink(
      { url: "https://example.com" },
      { id: "l1", now: 1 },
    );
    const note = buildNote({ content: "hello world" }, { id: "n1", now: 1 });
    expect(cardSecondaryLine(link)).toBe("example.com");
    expect(cardSecondaryLine(note)).toBe("hello world");
  });
});
