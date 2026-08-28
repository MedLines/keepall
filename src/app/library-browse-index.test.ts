import { describe, expect, test } from "vitest";
import { buildImage } from "@/domain/image";
import { buildLink } from "@/domain/link";
import { buildNote } from "@/domain/note";
import type { LibraryViewState } from "@/domain/library-view";
import {
  buildLibraryBrowseIndexes,
  filterAndSortLibraryItems,
  replaceItemInBrowseIndexes,
} from "./library-browse-index";

describe("library-browse-index", () => {
  const note = buildNote({ content: "n" }, { id: "n1", now: 1 });
  const link = {
    ...buildLink({ url: "https://a.example" }, { id: "l1", now: 2 }),
    collectionIds: ["c1"],
  };
  const image = {
    ...buildImage({ assetId: "a1" }, { id: "i1", now: 3 }),
    collectionIds: ["c1", "c2"],
    tagIds: ["t1"],
  };
  const items = [note, link, image];
  const tags = [{ id: "t1", name: "tag", createdAt: 1 }];
  const collectionsById = new Map([
    ["c1", { id: "c1", name: "One", createdAt: 1, pinnedItemIds: [] }],
    ["c2", { id: "c2", name: "Two", createdAt: 1, pinnedItemIds: [] }],
  ]);
  const indexes = buildLibraryBrowseIndexes(items);

  test("collection browse uses the indexed pool", () => {
    const view: LibraryViewState = {
      collection: "c1",
      unsorted: false,
      type: null,
      tag: null,
      q: "",
      layout: "grid",
      sort: "newest",
      item: null,
      slide: 0,
    };
    const filtered = filterAndSortLibraryItems(
      items,
      tags,
      view,
      collectionsById,
      indexes,
    );
    expect(filtered.map((item) => item.id)).toEqual(["i1", "l1"]);
  });

  test("unsorted browse uses the unsorted pool", () => {
    const view: LibraryViewState = {
      collection: null,
      unsorted: true,
      type: null,
      tag: null,
      q: "",
      layout: "grid",
      sort: "newest",
      item: null,
      slide: 0,
    };
    const filtered = filterAndSortLibraryItems(
      items,
      tags,
      view,
      collectionsById,
      indexes,
    );
    expect(filtered.map((item) => item.id)).toEqual(["n1"]);
  });

  test("replaceItemInBrowseIndexes swaps one row in pools without rebuild", () => {
    const updatedLink = {
      ...link,
      title: "patched",
    };
    const patchedIndexes = buildLibraryBrowseIndexes(items);
    expect(
      replaceItemInBrowseIndexes(patchedIndexes, "l1", updatedLink),
    ).toBe(true);
    const view: LibraryViewState = {
      collection: "c1",
      unsorted: false,
      type: null,
      tag: null,
      q: "",
      layout: "grid",
      sort: "newest",
      item: null,
      slide: 0,
    };
    const filtered = filterAndSortLibraryItems(
      items,
      tags,
      view,
      collectionsById,
      patchedIndexes,
    );
    expect(filtered.find((row) => row.id === "l1")?.title).toBe("patched");
  });
});
