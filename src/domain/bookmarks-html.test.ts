import { describe, expect, test } from "vitest";
import {
  BookmarksHtmlParseError,
  formatSkippedBookmarksLog,
  parseBookmarksHtml,
  shouldApplyHtmlCollection,
} from "./bookmarks-html";

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
  <DT><A HREF="https://example.com/" ADD_DATE="1">Root link</A>
  <DT><H3 ADD_DATE="2">Work</H3>
  <DL><p>
    <DT><A HREF="https://work.example/" ADD_DATE="3">Work link</A>
    <DT><H3 ADD_DATE="4">Design</H3>
    <DL><p>
      <DT><A HREF="https://design.example/" ADD_DATE="5" TAGS="inspo,ui">Design link</A>
    </DL><p>
  </DL><p>
</DL><p>`;

describe("parseBookmarksHtml", () => {
  test("extracts root, nested, and leaf folder names", () => {
    expect(parseBookmarksHtml(SAMPLE)).toEqual([
      {
        url: "https://example.com/",
        title: "Root link",
        tagNames: [],
        leafCollectionName: null,
      },
      {
        url: "https://work.example/",
        title: "Work link",
        tagNames: [],
        leafCollectionName: "Work",
      },
      {
        url: "https://design.example/",
        title: "Design link",
        tagNames: ["inspo", "ui"],
        leafCollectionName: "Design",
      },
    ]);
  });

  test("rejects empty or non-bookmark HTML", () => {
    expect(() => parseBookmarksHtml("")).toThrow(BookmarksHtmlParseError);
    expect(() => parseBookmarksHtml("<html><body>nope</body></html>")).toThrow(
      BookmarksHtmlParseError,
    );
  });
});

describe("shouldApplyHtmlCollection", () => {
  test("always files new links when a folder exists", () => {
    expect(
      shouldApplyHtmlCollection("keep", {
        created: true,
        itemIsUnsorted: false,
        hasFolder: true,
      }),
    ).toBe(true);
  });

  test("respects policy on reuse", () => {
    const reuse = {
      created: false,
      itemIsUnsorted: false,
      hasFolder: true,
    };
    expect(shouldApplyHtmlCollection("keep", reuse)).toBe(false);
    expect(shouldApplyHtmlCollection("apply", reuse)).toBe(true);
    expect(
      shouldApplyHtmlCollection("unsorted-only", {
        ...reuse,
        itemIsUnsorted: true,
      }),
    ).toBe(true);
  });
});

describe("formatSkippedBookmarksLog", () => {
  test("lists skipped rows for download", () => {
    const text = formatSkippedBookmarksLog([
      { url: "javascript:void(0)", title: "Bad", reason: "Invalid URL" },
    ]);
    expect(text).toContain("Skipped bookmarks (1)");
    expect(text).toContain("javascript:void(0)");
    expect(text).toContain("Invalid URL");
  });
});
