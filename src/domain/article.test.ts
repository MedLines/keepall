import { expect, test } from "vitest";
import { applyLinkEdit, buildLink, linkListTitle } from "./link";
import { parseSavedArticle } from "./article";
import { matchesSearchQuery, findSearchExcerpt } from "./search";
import { buildKeepallBackup, parseKeepallBackup } from "./backup";

const article = { title: "Saved reporting", text: "The curious narwhal swims offline.", sourceUrl: "https://example.com/story", capturedAt: 100, author: "A. Writer" };

test("saved article metadata is validated and restored without HTML interpretation", () => {
  expect(parseSavedArticle(article)).toEqual(article);
  expect(() => parseSavedArticle({ ...article, sourceUrl: "javascript:alert(1)" })).toThrow();
  expect(() => parseSavedArticle({ ...article, capturedAt: -1 })).toThrow();
  expect(() => parseSavedArticle({ ...article, text: "" })).toThrow();
  expect(() => parseSavedArticle({ ...article, text: "x".repeat(500_001) })).toThrow();
});

test("article text, author and title can be searched and explain results", () => {
  const item = { ...buildLink({ url: article.sourceUrl }), article };
  expect(matchesSearchQuery(item, "narwhal")).toBe(true);
  expect(matchesSearchQuery(item, '"saved reporting" writer')).toBe(true);
  expect(findSearchExcerpt(item, "narwhal")).toEqual({ label: "Saved article", text: article.text });
  expect(linkListTitle(item)).toBe(article.title);
});

test("URL edits discard the old article while note and title edits retain it", () => {
  const item = { ...buildLink({ url: article.sourceUrl, noteContent: "Personal" }), article };
  expect(applyLinkEdit(item, { url: item.url, noteContent: "Revised" }).article).toEqual(article);
  expect(applyLinkEdit(item, { url: "https://example.com/new" }).article).toBeUndefined();
});

test("JSON backup restores article fields and rejects damaged article records", () => {
  const item = { ...buildLink({ url: article.sourceUrl }), article };
  const backup = buildKeepallBackup({ items: [item], tags: [], collections: [] });
  expect(parseKeepallBackup(JSON.parse(JSON.stringify(backup))).items[0]).toEqual(item);
  expect(() => parseKeepallBackup({ ...backup, items: [{ ...item, article: { ...article, sourceUrl: "data:text/html,bad" } }] })).toThrow(/article/i);
});
