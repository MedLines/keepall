import { describe, expect, test } from "vitest";
import { buildLink } from "./link";
import { buildNote } from "./note";
import { buildImage } from "./image";
import { buildVideo } from "./video";
import type { DocumentItem } from "./document";
import { createSearchExcerpt, findSearchExcerpt, findSearchMatches, findTextMatches, matchesSearchQuery, normalizeSearchQuery } from "./search";

const document: DocumentItem = { id: "document", type: "document", format: "markdown", title: "Design reference", sourceFileName: "reference.md", assetId: "original", noteContent: "Review later", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 };

test("document search combines original text with title, personal notes and tags", () => {
  const text = "# Animation examples\nمرحبا café\nİstanbul";
  expect(matchesSearchQuery(document, 'design "animation examples"', [], text)).toBe(true);
  expect(matchesSearchQuery(document, "review animation inspiration", ["Inspiration"], text)).toBe(true);
  expect(matchesSearchQuery(document, "مرحبا CAFÉ", [], text)).toBe(true);
  expect(matchesSearchQuery(document, '"design animation"', [], text)).toBe(false);
  expect(matchesSearchQuery(document, "animation missing", [], text)).toBe(false);
  expect(matchesSearchQuery(buildNote({ content: "Different note" }), "animation", [], text)).toBe(false);
});

test("file excerpts find late matches and preserve their case and Unicode offsets", () => {
  const text = "İ" + "x".repeat(30_000) + " Animation examples مرحبا";
  const excerpt = findSearchExcerpt(document, "animation", [], text);
  expect(excerpt?.label).toBe("File contents");
  expect(excerpt?.text).toContain("Animation examples");
  expect(excerpt?.text.length).toBeLessThanOrEqual(162);
  expect(findSearchExcerpt(document, "review animation", [], text)?.label).toBe("My note");
  expect(findSearchExcerpt(document, "missing", [], text)).toBeUndefined();
});

describe("normalizeSearchQuery", () => {
  test("trims and lowercases", () => {
    expect(normalizeSearchQuery("  HeLLo  ")).toBe("hello");
  });

  test("whitespace-only becomes empty", () => {
    expect(normalizeSearchQuery("   ")).toBe("");
  });
});

describe("matchesSearchQuery", () => {
  const note = buildNote(
    { title: "Sketch", content: "A persisted note about Design" },
    { id: "n1", now: 1 },
  );
  const link = buildLink(
    { title: "Docs", url: "https://example.com/guide" },
    { id: "l1", now: 1 },
  );

  test("empty or whitespace query matches every item", () => {
    expect(matchesSearchQuery(note, "")).toBe(true);
    expect(matchesSearchQuery(link, "   ")).toBe(true);
  });

  test("matches note title and content case-insensitively", () => {
    expect(matchesSearchQuery(note, "sketch")).toBe(true);
    expect(matchesSearchQuery(note, "DESIGN")).toBe(true);
    expect(matchesSearchQuery(note, "missing")).toBe(false);
  });

  test("requires every word across fields, in any order", () => {
    const saved = { ...link, title: "React patterns", noteContent: "Useful animation examples" };
    expect(matchesSearchQuery(saved, " REACT   animation ")).toBe(true);
    expect(matchesSearchQuery(saved, "animation react")).toBe(true);
    expect(matchesSearchQuery(saved, "react missing")).toBe(false);
    expect(matchesSearchQuery(saved, "react inspiration", ["Inspiration"])).toBe(true);
  });

  test("keeps quoted phrases in one field and supports mixed terms", () => {
    const saved = { ...link, title: "React patterns", noteContent: "Useful animation examples" };
    expect(matchesSearchQuery(saved, 'react "animation examples"')).toBe(true);
    expect(matchesSearchQuery(saved, '"react animation"')).toBe(false);
    expect(matchesSearchQuery(saved, 'react "examples animation"')).toBe(false);
    expect(matchesSearchQuery(saved, 'react "animation examples')).toBe(true);
    expect(matchesSearchQuery(saved, '""')).toBe(true);
  });

  test("matches link title and URL case-insensitively", () => {
    expect(matchesSearchQuery(link, "docs")).toBe(true);
    expect(matchesSearchQuery(link, "EXAMPLE.COM")).toBe(true);
    expect(matchesSearchQuery(link, "missing")).toBe(false);
  });

  test("includes personal notes and website preview text", () => {
    const saved = { ...link, noteContent: "Remember the spacing", previewTitle: "Layout handbook", previewDescription: "A typography reference" };
    for (const query of [" SPACING ", "handbook", "typography"]) expect(matchesSearchQuery(saved, query)).toBe(true);
    expect(matchesSearchQuery(link, "undefined")).toBe(false);
    expect(findSearchMatches(saved, "the")[0].field).toBe("noteContent");
  });

  test("does not match unrelated note content against a link", () => {
    expect(matchesSearchQuery(link, "persisted")).toBe(false);
  });

  test("matches resolved tag names case-insensitively", () => {
    expect(matchesSearchQuery(note, "design", ["Inspiration"])).toBe(true);
    expect(matchesSearchQuery(note, "WORK", ["work", "reading"])).toBe(true);
    expect(matchesSearchQuery(note, "missing", ["Design"])).toBe(false);
  });

  test("preserves image, video, and tag coverage and excerpt priority", () => {
    const image = buildImage({ assetId: "a", title: "Still life", caption: "Blue vase", sourceUrl: "https://example.com/gallery" });
    for (const query of ["still", "vase", "gallery"]) expect(matchesSearchQuery(image, query)).toBe(true);
    const video = buildVideo({ assetId: "v", fileName: "demo.mp4", title: "Motion", noteContent: "Spring reference" });
    for (const query of ["motion", ".mp4", "spring"]) expect(matchesSearchQuery(video, query)).toBe(true);
    expect(findSearchMatches(image, "blue", ["Blue inspiration"]).map(match => match.field)).toEqual(["caption", "tag"]);
  });
});

describe("search ranges and excerpts", () => {
  test("finds separate term matches and excerpts even when other words match another field", () => {
    const saved = buildNote({ title: "React patterns", content: "x".repeat(250) + "Animation examples" });
    const matches = findSearchMatches(saved, "react animation");
    expect(matches.map(match => match.field)).toEqual(["content", "title"]);
    expect(matches[0].ranges).toEqual([{ start: 250, end: 259 }]);
    expect(createSearchExcerpt(saved.content, "react animation")).toContain("Animation");
  });
  test("finds literal repeated matches and preserves original offsets", () => {
    expect(findTextMatches("A+B then a+b", " a+b ")).toEqual([{ start: 0, end: 3 }, { start: 9, end: 12 }]);
    expect(findTextMatches("anything", " ")).toEqual([]);
    expect(findTextMatches("İstanbul DESIGN", "design")).toEqual([{ start: 9, end: 15 }]);
  });

  test("keeps complete matches at the beginning, middle and end", () => {
    for (const text of ["needle" + "x".repeat(300), "x".repeat(300) + "needle", "x".repeat(200) + "needle" + "x".repeat(200)]) {
      const excerpt = createSearchExcerpt(text, "needle");
      expect(excerpt).toContain("needle");
      expect(excerpt.length).toBeLessThanOrEqual(162);
      expect(excerpt).toContain("…");
    }
    const query = "long".repeat(50);
    expect(createSearchExcerpt("before " + query + " after", query)).toContain(query);
    expect(createSearchExcerpt("Short text", "short")).toBe("Short text");
  });
});
