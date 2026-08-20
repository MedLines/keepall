import { describe, expect, test } from "vitest";
import { buildLink } from "./link";
import { buildNote } from "./note";
import { matchesSearchQuery, normalizeSearchQuery } from "./search";

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

  test("matches link title and URL case-insensitively", () => {
    expect(matchesSearchQuery(link, "docs")).toBe(true);
    expect(matchesSearchQuery(link, "EXAMPLE.COM")).toBe(true);
    expect(matchesSearchQuery(link, "missing")).toBe(false);
  });

  test("does not match unrelated note content against a link", () => {
    expect(matchesSearchQuery(link, "persisted")).toBe(false);
  });
});
