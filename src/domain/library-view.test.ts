import { describe, expect, test } from "vitest";
import { buildLink } from "./link";
import {
  libraryViewHref,
  libraryViewStateToSearchParams,
  parseLibraryViewState,
  sortLibraryItems,
} from "./library-view";
import { buildNote } from "./note";

describe("parseLibraryViewState", () => {
  test("reads q, collection, and sort with defaults", () => {
    expect(parseLibraryViewState(new URLSearchParams())).toEqual({
      q: "",
      collection: null,
      sort: "newest",
    });

    expect(
      parseLibraryViewState(
        new URLSearchParams("q=design&collection=c1&sort=oldest"),
      ),
    ).toEqual({
      q: "design",
      collection: "c1",
      sort: "oldest",
    });
  });

  test("treats blank collection as null and unknown sort as newest", () => {
    expect(
      parseLibraryViewState(new URLSearchParams("collection=&sort=nope")),
    ).toEqual({
      q: "",
      collection: null,
      sort: "newest",
    });
  });
});

describe("libraryViewStateToSearchParams", () => {
  test("omits empty q, missing collection, and default newest sort", () => {
    expect(
      libraryViewStateToSearchParams({
        q: "  ",
        collection: null,
        sort: "newest",
      }).toString(),
    ).toBe("");

    expect(
      libraryViewStateToSearchParams({
        q: " design ",
        collection: "c1",
        sort: "oldest",
      }).toString(),
    ).toBe("q=design&collection=c1&sort=oldest");
  });
});

describe("libraryViewHref", () => {
  test("builds pathname with or without query", () => {
    expect(
      libraryViewHref("/", { q: "", collection: null, sort: "newest" }),
    ).toBe("/");
    expect(
      libraryViewHref("/", { q: "x", collection: null, sort: "newest" }),
    ).toBe("/?q=x");
  });
});

describe("sortLibraryItems", () => {
  test("orders by createdAt", () => {
    const older = buildNote({ content: "older" }, { id: "a", now: 1 });
    const newer = buildLink(
      { url: "https://example.com" },
      { id: "b", now: 2 },
    );

    expect(sortLibraryItems([older, newer], "newest").map((i) => i.id)).toEqual(
      ["b", "a"],
    );
    expect(sortLibraryItems([older, newer], "oldest").map((i) => i.id)).toEqual(
      ["a", "b"],
    );
  });
});
