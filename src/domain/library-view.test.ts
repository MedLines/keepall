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
      slide: 0,
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
      slide: 0,
    });

    expect(
      parseLibraryViewState(
        new URLSearchParams("item=i1&slide=2"),
      ),
    ).toEqual({
      q: "",
      collection: null,
      sort: "newest",
      item: "i1",
      slide: 2,
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
      slide: 0,
    });
  });

  test("ignores slide when item is missing", () => {
    expect(parseLibraryViewState(new URLSearchParams("slide=3"))).toEqual({
      q: "",
      collection: null,
      sort: "newest",
      item: null,
      slide: 0,
    });
  });
});

describe("libraryViewStateToSearchParams", () => {
  test("omits empty q, missing collection/item, default newest sort, and slide 0", () => {
    expect(
      libraryViewStateToSearchParams({
        q: "  ",
        collection: null,
        sort: "newest",
        item: null,
        slide: 0,
      }).toString(),
    ).toBe("");

    expect(
      libraryViewStateToSearchParams({
        q: " design ",
        collection: "c1",
        sort: "oldest",
        item: "n1",
        slide: 0,
      }).toString(),
    ).toBe("q=design&collection=c1&sort=oldest&item=n1");

    expect(
      libraryViewStateToSearchParams({
        q: "",
        collection: null,
        sort: "newest",
        item: "i1",
        slide: 2,
      }).toString(),
    ).toBe("item=i1&slide=2");
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
        slide: 0,
      }),
    ).toBe("/");
    expect(
      libraryViewHref("/", {
        q: "x",
        collection: null,
        sort: "newest",
        item: null,
        slide: 0,
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
