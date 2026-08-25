import { describe, expect, test } from "vitest";
import { buildLink } from "./link";
import {
  itemMediaLayoutId,
  libraryViewHref,
  libraryViewStateToSearchParams,
  parseLibraryViewState,
  sortLibraryItems,
} from "./library-view";
import { buildNote } from "./note";

describe("parseLibraryViewState", () => {
  test("reads q, collection, sort, and item with defaults", () => {
    expect(parseLibraryViewState(new URLSearchParams())).toEqual({
      q: "",
      collection: null,
      sort: "newest",
      item: null,
    });

    expect(
      parseLibraryViewState(
        new URLSearchParams("q=design&collection=c1&sort=oldest&item=n1"),
      ),
    ).toEqual({
      q: "design",
      collection: "c1",
      sort: "oldest",
      item: "n1",
    });
  });

  test("treats blank collection/item as null and unknown sort as newest", () => {
    expect(
      parseLibraryViewState(
        new URLSearchParams("collection=&item=&sort=nope"),
      ),
    ).toEqual({
      q: "",
      collection: null,
      sort: "newest",
      item: null,
    });
  });
});

describe("libraryViewStateToSearchParams", () => {
  test("omits empty q, missing collection/item, and default newest sort", () => {
    expect(
      libraryViewStateToSearchParams({
        q: "  ",
        collection: null,
        sort: "newest",
        item: null,
      }).toString(),
    ).toBe("");

    expect(
      libraryViewStateToSearchParams({
        q: " design ",
        collection: "c1",
        sort: "oldest",
        item: "n1",
      }).toString(),
    ).toBe("q=design&collection=c1&sort=oldest&item=n1");
  });
});

describe("libraryViewHref", () => {
  test("builds pathname with or without query", () => {
    expect(
      libraryViewHref("/", {
        q: "",
        collection: null,
        sort: "newest",
        item: null,
      }),
    ).toBe("/");
    expect(
      libraryViewHref("/", {
        q: "x",
        collection: null,
        sort: "newest",
        item: null,
      }),
    ).toBe("/?q=x");
  });
});

describe("itemMediaLayoutId", () => {
  test("stable per item id", () => {
    expect(itemMediaLayoutId("n1")).toBe("keepall-item-media-n1");
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
