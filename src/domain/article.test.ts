import { expect, test } from "vitest";
import { applyLinkEdit, buildLink, linkListTitle } from "./link";
import { MAX_ARTICLE_CONTENT_DEPTH, MAX_ARTICLE_CONTENT_NODES, articleContentText, parseSavedArticle, type ArticleNode } from "./article";
import { matchesSearchQuery, findSearchExcerpt } from "./search";
import { buildKeepallBackup, parseKeepallBackup } from "./backup";

const article = { title: "Saved reporting", text: "The curious narwhal swims offline.", sourceUrl: "https://example.com/story", capturedAt: 100, author: "A. Writer" };

test("saved article metadata is validated and restored without HTML interpretation", () => {
  expect(parseSavedArticle(article)).toEqual(article);
  expect(() => parseSavedArticle({ ...article, sourceUrl: "javascript:alert(1)" })).toThrow();
  expect(() => parseSavedArticle({ ...article, capturedAt: -1 })).toThrow();
  expect(() => parseSavedArticle({ ...article, capturedAt: 8.64e15 + 1 })).toThrow();
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

test("structured content drives searchable text and survives JSON restore with site and date metadata", () => {
  const content: ArticleNode[] = [{ tag: "h2", children: [{ text: "Migration evidence" }] }, { tag: "p", children: [{ text: "The narwhal returns." }, { tag: "a", href: "https://example.com/reference", children: [{ text: " Read the reference." }] }] }];
  const saved = parseSavedArticle({ ...article, text: "outdated text", content, siteName: "Ocean Journal", publishedAt: "2026-09-30" });
  expect(saved.text).toBe(articleContentText(content));
  const item = { ...buildLink({ url: article.sourceUrl }), article: saved };
  expect(matchesSearchQuery(item, '"migration evidence"')).toBe(true);
  expect(matchesSearchQuery(item, '"ocean journal"')).toBe(true);
  expect(parseKeepallBackup(JSON.parse(JSON.stringify(buildKeepallBackup({ items: [item], tags: [], collections: [] })))).items[0]).toEqual(item);
});

test.each(["script", "iframe", "img", "style", "input"])("restored %s elements are rejected", tag => {
  expect(() => parseSavedArticle({ ...article, content: [{ tag, children: [{ text: "Unsafe" }] }] })).toThrow();
});

test.each(["javascript:alert(1)", "data:text/html,bad", "https://user:secret@example.com/", "//example.com/story"])("restored unsafe link %s is rejected", href => {
  expect(() => parseSavedArticle({ ...article, content: [{ tag: "a", href, children: [{ text: "Unsafe" }] }] })).toThrow();
});

test("structure limits bound node counts, nesting and aggregate text; untrusted attributes are discarded", () => {
  expect(() => parseSavedArticle({ ...article, content: Array.from({ length: MAX_ARTICLE_CONTENT_NODES + 1 }, () => ({ text: "x" })) })).toThrow();
  let nested: ArticleNode[] = [{ text: "Inner content" }];
  for (let i = 0; i <= MAX_ARTICLE_CONTENT_DEPTH; i++) nested = [{ tag: "section", children: nested }];
  expect(() => parseSavedArticle({ ...article, content: nested })).toThrow();
  expect(() => parseSavedArticle({ ...article, content: [{ text: "x".repeat(250_001) }, { text: "y".repeat(250_000) }] })).toThrow();
  const clean = parseSavedArticle({ ...article, content: [{ tag: "p", onclick: "alert(1)", style: "color:red", children: [{ text: "Safe text" }] }] });
  expect(clean.content).toEqual([{ tag: "p", children: [{ text: "Safe text" }] }]);
});
