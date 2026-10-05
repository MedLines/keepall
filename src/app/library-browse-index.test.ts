import { describe, expect, test } from "vitest";
import { buildImage } from "@/domain/image";
import { buildLink } from "@/domain/link";
import { buildNote } from "@/domain/note";
import type { LibraryViewState } from "@/domain/library-view";
import { parseLibraryViewState } from "@/domain/library-view";
import type { Collection } from "@/domain/collection";
import type { DocumentItem } from "@/domain/document";
import {
  buildLibraryBrowseIndexes,
  filterAndSortLibraryItems,
  replaceItemInBrowseIndexes,
} from "./library-browse-index";

describe("library-browse-index", () => {
  test("Notes includes imported text and Markdown, including combined collection and tag filters", () => {
    const note = buildNote({ content: "Inline note" }, { id: "note", now: 1 });
    const text: DocumentItem = { id: "text", type: "document", format: "text", title: "Imported text", sourceFileName: "note.txt", assetId: "original", noteContent: "", tagIds: ["tag"], collectionIds: ["collection"], createdAt: 2, updatedAt: 2 };
    const markdown: DocumentItem = { ...text, id: "markdown", format: "markdown", sourceFileName: "note.md", createdAt: 3 };
    const items = [note, text, markdown, buildLink({ url: "https://example.com" })];
    const indexes = buildLibraryBrowseIndexes(items);
    const view = parseLibraryViewState(new URLSearchParams("type=note"));
    expect(filterAndSortLibraryItems(items, [], view, new Map(), indexes).map((item) => item.id)).toEqual(["markdown", "text", "note"]);
    expect(filterAndSortLibraryItems(items, [], { ...view, collection: "collection", tag: "tag" }, new Map(), indexes).map((item) => item.id)).toEqual(["markdown", "text"]);
  });
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

  test("best match ranks titles above incidental text, breaks ties by date, and respects pins", () => {
    const title = buildNote({ title: "React patterns", content: "Animation examples" }, { id: "title", now: 1 });
    const titleNewer = { ...title, id: "title-newer", createdAt: 2 };
    const incidental = buildNote({ title: "Reference", content: "React animation" }, { id: "incidental", now: 10 });
    const missing = buildNote({ title: "React only", content: "Missing the other term" }, { id: "missing", now: 20 });
    const candidates = [incidental, title, titleNewer, missing].map(item => ({ ...item, collectionIds: ["c1"] }));
    const browseIndexes = buildLibraryBrowseIndexes(candidates);
    const view = parseLibraryViewState(new URLSearchParams("q=react+animation&sort=relevance"));
    expect(filterAndSortLibraryItems(candidates, [], view, collectionsById, browseIndexes).map(item => item.id))
      .toEqual(["title-newer", "title", "incidental"]);
    const pinnedCollections = new Map<string, Collection>(collectionsById);
    pinnedCollections.set("c1", { ...collectionsById.get("c1")!, pinnedItemIds: ["incidental"] });
    expect(filterAndSortLibraryItems(candidates, [], { ...view, collection: "c1" }, pinnedCollections, browseIndexes).map(item => item.id))
      .toEqual(["incidental", "title-newer", "title"]);
    expect(filterAndSortLibraryItems(candidates, [], { ...view, q: "" }, collectionsById, browseIndexes).map(item => item.id))
      .toEqual(["missing", "incidental", "title-newer", "title"]);
  });

  test("personal-note search respects combined filters and collection pin order", () => {
    const older = { ...link, noteContent: "Quartz layout", tagIds: ["t1"] };
    const newer = { ...older, id: "newer", createdAt: 10 };
    const outside = { ...older, id: "outside", collectionIds: [] };
    const candidates = [older, newer, outside];
    const collectionMap = new Map<string, Collection>(collectionsById);
    collectionMap.set("c1", { ...collectionsById.get("c1")!, pinnedItemIds: [older.id] });
    const view: LibraryViewState = {
      collection: "c1", unsorted: false, type: "link", tag: "t1", q: "quartz",
      layout: "grid", sort: "newest", item: null, slide: 0,
    };
    const result = filterAndSortLibraryItems(candidates, tags, view, collectionMap, buildLibraryBrowseIndexes(candidates));
    expect(result.map(item => item.id)).toEqual([older.id, newer.id]);
  });

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
