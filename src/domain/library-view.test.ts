import { describe, expect, test } from "vitest";
import { buildLink } from "./link";
import {
  itemMediaLayoutId,
  libraryViewHref,
  libraryViewStateToSearchParams,
  parseLibraryLayout,
  parseLibraryType,
  parseLibraryViewState,
  sortLibraryItems,
  sortLibraryItemsWithCollectionPins,
  mergeLibraryViewState,
} from "./library-view";
import { buildNote } from "./note";

const emptyView = {
  q: "",
  collection: null,
  unsorted: false,
  tag: null,
  type: null,
  layout: "grid" as const,
  sort: "newest" as const,
  item: null,
  slide: 0,
};

describe("parseLibraryType", () => {
  test("accepts link note image and rejects unknown", () => {
    expect(parseLibraryType("link")).toBe("link");
    expect(parseLibraryType("note")).toBe("note");
    expect(parseLibraryType("image")).toBe("image");
    expect(parseLibraryType("other")).toBeNull();
    expect(parseLibraryType(null)).toBeNull();
  });
});

describe("parseLibraryLayout", () => {
  test("accepts list and defaults to grid", () => {
    expect(parseLibraryLayout("list")).toBe("list");
    expect(parseLibraryLayout("grid")).toBe("grid");
    expect(parseLibraryLayout("masonry")).toBe("grid");
    expect(parseLibraryLayout(null)).toBe("grid");
  });
});

describe("parseLibraryViewState", () => {
  test("reads q, collection, tag, type, layout, sort, and item with defaults", () => {
    expect(parseLibraryViewState(new URLSearchParams())).toEqual(emptyView);

    expect(
      parseLibraryViewState(
        new URLSearchParams(
          "q=design&collection=c1&tag=t1&type=link&layout=list&sort=oldest&item=n1",
        ),
      ),
    ).toEqual({
      q: "design",
      collection: "c1",
      unsorted: false,
      tag: "t1",
      type: "link",
      layout: "list",
      sort: "oldest",
      item: "n1",
      slide: 0,
    });

    expect(
      parseLibraryViewState(new URLSearchParams("item=i1&slide=2")),
    ).toEqual({
      ...emptyView,
      item: "i1",
      slide: 2,
    });
  });

  test("reads unsorted=1 and lets collection win when both are present", () => {
    expect(
      parseLibraryViewState(new URLSearchParams("unsorted=1")),
    ).toEqual({ ...emptyView, unsorted: true });

    expect(
      parseLibraryViewState(
        new URLSearchParams("collection=c1&unsorted=1"),
      ),
    ).toEqual({ ...emptyView, collection: "c1", unsorted: false });
  });

  test("treats blank collection/tag/item as null and unknown sort/type as defaults", () => {
    expect(
      parseLibraryViewState(
        new URLSearchParams("collection=&tag=&item=&sort=nope&type=video"),
      ),
    ).toEqual(emptyView);
  });

  test("ignores slide when item is missing", () => {
    expect(parseLibraryViewState(new URLSearchParams("slide=3"))).toEqual(
      emptyView,
    );
  });
});

describe("libraryViewStateToSearchParams", () => {
  test("omits empty q, missing filters, default grid/newest, and slide 0", () => {
    expect(
      libraryViewStateToSearchParams({
        ...emptyView,
        q: "  ",
      }).toString(),
    ).toBe("");

    expect(
      libraryViewStateToSearchParams({
        q: " design ",
        collection: "c1",
        unsorted: false,
        tag: "t1",
        type: "note",
        layout: "list",
        sort: "oldest",
        item: "n1",
        slide: 0,
      }).toString(),
    ).toBe(
      "q=design&collection=c1&tag=t1&type=note&layout=list&sort=oldest&item=n1",
    );

    expect(
      libraryViewStateToSearchParams({
        ...emptyView,
        item: "i1",
        slide: 2,
      }).toString(),
    ).toBe("item=i1&slide=2");
  });

  test("writes unsorted=1 and omits it when a collection is set", () => {
    expect(
      libraryViewStateToSearchParams({
        ...emptyView,
        unsorted: true,
      }).toString(),
    ).toBe("unsorted=1");

    expect(
      libraryViewStateToSearchParams({
        ...emptyView,
        collection: "c1",
        unsorted: true,
      }).toString(),
    ).toBe("collection=c1");
  });
});

describe("mergeLibraryViewState", () => {
  test("clears unsorted when a collection is set and the reverse", () => {
    expect(
      mergeLibraryViewState({ ...emptyView, unsorted: true }, { collection: "c1" }),
    ).toEqual({ ...emptyView, collection: "c1", unsorted: false });

    expect(
      mergeLibraryViewState({ ...emptyView, collection: "c1" }, { unsorted: true }),
    ).toEqual({ ...emptyView, collection: null, unsorted: true });
  });

  test("lets collection win when a patch sets both", () => {
    expect(
      mergeLibraryViewState(emptyView, {
        collection: "c1",
        unsorted: true,
      }),
    ).toEqual({ ...emptyView, collection: "c1", unsorted: false });
  });
});

describe("libraryViewHref", () => {
  test("builds pathname with or without query", () => {
    expect(libraryViewHref("/", emptyView)).toBe("/");
    expect(libraryViewHref("/", { ...emptyView, q: "x" })).toBe("/?q=x");
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

describe("sortLibraryItemsWithCollectionPins", () => {
  test("puts pinned ids first then applies sort", () => {
    const a = buildNote({ content: "a" }, { id: "a", now: 1 });
    const b = buildNote({ content: "b" }, { id: "b", now: 2 });
    const c = buildNote({ content: "c" }, { id: "c", now: 3 });

    expect(
      sortLibraryItemsWithCollectionPins([a, b, c], "newest", ["a", "c"]).map(
        (item) => item.id,
      ),
    ).toEqual(["a", "c", "b"]);
  });

  test("skips unknown pin ids", () => {
    const a = buildNote({ content: "a" }, { id: "a", now: 1 });
    expect(
      sortLibraryItemsWithCollectionPins([a], "newest", ["missing", "a"]).map(
        (item) => item.id,
      ),
    ).toEqual(["a"]);
  });

  test("falls back to sort when pins is null", () => {
    const older = buildNote({ content: "older" }, { id: "a", now: 1 });
    const newer = buildNote({ content: "newer" }, { id: "b", now: 2 });
    expect(
      sortLibraryItemsWithCollectionPins([older, newer], "newest", null).map(
        (item) => item.id,
      ),
    ).toEqual(["b", "a"]);
  });
});
