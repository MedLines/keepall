import { describe, expect, test } from "vitest";
import { buildNote } from "./note";
import { buildLink } from "./link";
import { buildImage } from "./image";
import { buildVideo } from "./video";
import { itemActionLabel } from "./item-label";

describe("itemActionLabel", () => {
  test("uses the first nonempty line of a saved article title without changing it", () => {
    const note = buildNote({ title: "\n Article title\r\n" + "Article body ".repeat(500), content: "Full content" });
    const original = { ...note };
    expect(itemActionLabel(note)).toBe("Article title");
    expect(note).toEqual(original);
  });

  test.each([
    ["First line\nSecond paragraph", undefined, "First line"],
    ["# Literal plain text\nBody", undefined, "# Literal plain text"],
    ["# **Card study**\n\nBody", "markdown", "Card study"],
    ["![Image](keepall-image:a1)\n\n# Card study\nBody", "markdown", "Card study"],
    ["[Card study](https://example.com/long-url)", "markdown", "Card study"],
    ["- [ ] Review layout", "markdown", "Review layout"],
    ["> A quoted passage", "markdown", "A quoted passage"],
    ["```ts\nconst example = true;\n```", "markdown", "Untitled note"],
    ["![Image](keepall-image:a1)", "markdown", "Untitled note"],
    ["---\nBody", "markdown", "Untitled note"],
    ["***", "markdown", "Untitled note"],
    ["###", "markdown", "Untitled note"],
    ["  \r\n ", undefined, "Untitled note"],
  ] as const)("labels content %j with format %s", (content, format, expected) => {
    const note = { ...buildNote({ content: "placeholder" }), content, title: " \t ", ...(format ? { format } : {}) };
    expect(itemActionLabel(note)).toBe(expected);
  });

  test.each([false, true])("caps a long unbroken note line with explicit title %s", (explicit) => {
    const text = "a".repeat(1000);
    expect(itemActionLabel(buildNote({ content: text, ...(explicit ? { title: text } : {}) })))
      .toBe("a".repeat(63) + "…");
  });

  test("preserves emoji and combining marks at the cutoff", () => {
    const emoji = "👩🏽‍💻";
    expect(itemActionLabel(buildNote({ content: emoji.repeat(80) }))).toBe(emoji.repeat(63) + "…");
    const accent = "e\u0301";
    expect(itemActionLabel(buildNote({ title: accent.repeat(80), content: "Body" }))).toBe(accent.repeat(63) + "…");
  });

  test("keeps short labels and normalizes tabs and spaces", () => {
    expect(itemActionLabel(buildNote({ title: "  My\t  note  ", content: "Body" }))).toBe("My note");
    expect(itemActionLabel(buildNote({ content: "a".repeat(64) }))).toBe("a".repeat(64));
  });

  test("uses a word boundary when shortening an article", () => {
    expect(itemActionLabel(buildNote({ content: "A detailed observation about how the library should display a large article" })))
      .toBe("A detailed observation about how the library should display a…");
  });

  test("uses link preview titles or hosts and caps very long titles", () => {
    const link = buildLink({ url: "https://example.com/article" });
    expect(itemActionLabel({ ...link, title: " ", previewTitle: " Preview title\nDetails" })).toBe("Preview title");
    expect(itemActionLabel({ ...link, title: " ", previewTitle: " " })).toBe("example.com");
    expect(itemActionLabel({ ...link, title: "x".repeat(1000) })).toBe("x".repeat(63) + "…");
    expect(itemActionLabel({ ...link, url: "x".repeat(1000) })).toBe("x".repeat(63) + "…");
  });

  test("uses image captions or hosts without copying the full caption", () => {
    const image = buildImage({ assetId: "a1" });
    expect(itemActionLabel({ ...image, title: " ", caption: "First sentence\nLong caption body" })).toBe("First sentence");
    expect(itemActionLabel({ ...image, caption: "# **Study**\nBody", captionFormat: "markdown" })).toBe("Study");
    expect(itemActionLabel({ ...image, caption: " ", sourceUrl: "https://example.com/image" })).toBe("example.com");
    expect(itemActionLabel(image)).toBe("Image");
  });

  test("caps video titles and provides an empty-title fallback", () => {
    const video = buildVideo({ assetId: "a1", fileName: "clip.mp4" });
    expect(itemActionLabel({ ...video, title: "x".repeat(1000) })).toBe("x".repeat(63) + "…");
    expect(itemActionLabel({ ...video, title: " " })).toBe("Video");
  });
});
