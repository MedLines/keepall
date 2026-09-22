import { describe, expect, test } from "vitest";
import {
  cardInitial,
  cardSecondaryLine,
  linkCardHost,
  linkFaviconUrl,
  noteCardSnippet,
  noteCardExcerpt,
  noteCardText,
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

  test("uses the first letter of an untitled note's content", () => {
    const note = buildNote({ content: "flour" }, { id: "n1", now: 1 });
    expect(cardInitial(note)).toBe("F");
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

describe("linkFaviconUrl", () => {
  test("builds a Google favicon URL from the link hostname", () => {
    expect(linkFaviconUrl("https://docs.example.com/path")).toBe(
      "https://www.google.com/s2/favicons?domain=docs.example.com&sz=128",
    );
  });

  test("returns null for invalid URLs", () => {
    expect(linkFaviconUrl("not-a-url")).toBeNull();
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

  test("removes Markdown punctuation from a card preview", () => {
    const note = buildNote({
      content: "# Card study\n\n- [x] Check **corners**\n\nSee [source](https://example.com).\n\n```tsx\nconst gap = 8;\n```",
      format: "markdown",
    });
    expect(noteCardText(note)).toBe("Card study Check corners See source. Code example");
    expect(noteCardSnippet(note)).not.toContain("#");
  });
});

describe("noteCardExcerpt", () => {
  test("starts after the Markdown title and stops at a short sentence", () => {
    const note = buildNote({ content: "# Image card redesign\n\nThe image should lead. Controls should help without competing.\n\n## Details\n\nMore content follows.", format: "markdown" });
    expect(noteCardExcerpt(note)).toBe("The image should lead. Controls should help without competing.");
  });

  test("does not repeat a plain note's first line as both title and excerpt", () => {
    const note = buildNote({ content: "Card layout\n\nLeave space below the image." });
    expect(noteCardExcerpt(note)).toBe("Leave space below the image.");
  });

  test("shows body text even when it directly follows the first line", () => {
    const note = buildNote({ content: "Card layout\nKeep the whole image visible.\nUse a calm border." });
    expect(noteCardExcerpt(note)).toBe("Keep the whole image visible. Use a calm border.");
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
