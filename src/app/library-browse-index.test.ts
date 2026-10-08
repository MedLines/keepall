import { describe, expect, test } from "vitest";
import { buildImage } from "@/domain/image";
import { buildLink } from "@/domain/link";
import { buildNote } from "@/domain/note";
import type { LibraryViewState } from "@/domain/library-view";
import { parseLibraryViewState } from "@/domain/library-view";
import type { Collection } from "@/domain/collection";
import type { DocumentItem } from "@/domain/document";
import { countSidebarItems } from "./library-sidebar-counts";
import {
  buildLibraryBrowseIndexes,
  filterAndSortLibraryItems,
  replaceItemInBrowseIndexes,
} from "./library-browse-index";

describe("library-browse-index", () => {
  test("combines selected types without duplicates and intersects them with the scope", () => {
    const image = { ...buildImage({ assetId: "asset" }, { id: "image", now: 3 }), tagIds: ["tag"], collectionIds: ["collection"] };
    const note = buildNote({ content: "Note" }, { id: "note", now: 1 });
    const text: DocumentItem = { id: "text", type: "document", format: "text", title: "Text", sourceFileName: "text.txt", assetId: "text", noteContent: "", tagIds: ["tag"], collectionIds: ["collection"], createdAt: 2, updatedAt: 2 };
    const pdf: DocumentItem = { ...text, id: "pdf", format: "pdf", createdAt: 4 };
    const candidates = [image, note, text, pdf, buildLink({ url: "https://example.com" })];
    const indexes = buildLibraryBrowseIndexes(candidates);
    const view = parseLibraryViewState(new URLSearchParams("type=image,note,document"));
    expect(filterAndSortLibraryItems(candidates, [], view, new Map(), indexes).map(item => item.id)).toEqual(["pdf", "image", "text", "note"]);
    expect(filterAndSortLibraryItems(candidates, [], { ...view, tag: "tag", collection: "collection", q: "Text" }, new Map(), indexes).map(item => item.id)).toEqual(["pdf", "text"]);
  });
  test("file-content matches participate in combined filters, relevance and collection pins", () => {
    const first: DocumentItem = { id: "first", type: "document", format: "text", title: "Reference", sourceFileName: "reference.txt", assetId: "one", noteContent: "", tagIds: ["tag"], collectionIds: ["collection"], createdAt: 1, updatedAt: 1 };
    const second = { ...first, id: "second", createdAt: 2 };
    const outside = { ...first, id: "outside", collectionIds: [] };
    const candidates = [first, second, outside];
    const view = parseLibraryViewState(new URLSearchParams("q=animation&type=note&tag=tag&collection=collection&sort=relevance"));
    const matches = new Map([[first.id, { score: 4 }], [second.id, { score: 8 }], [outside.id, { score: 8 }]]);
    const collections = new Map([["collection", { id: "collection", name: "Reading", createdAt: 1, pinnedItemIds: [first.id] }]]);
    expect(filterAndSortLibraryItems(candidates, [], view, collections, buildLibraryBrowseIndexes(candidates), matches).map(item => item.id)).toEqual([first.id, second.id]);
    expect(filterAndSortLibraryItems(candidates, [], { ...view, collection: null }, collections, buildLibraryBrowseIndexes(candidates), matches).map(item => item.id)).toEqual([second.id, outside.id, first.id]);
    expect(filterAndSortLibraryItems(candidates, [], view, collections, buildLibraryBrowseIndexes(candidates), new Map())).toEqual([]);
  });
  test("Notes includes imported text and Markdown, including combined collection and tag filters", () => {
    const note = buildNote({ content: "Inline note" }, { id: "note", now: 1 });
    const text: DocumentItem = { id: "text", type: "document", format: "text", title: "Imported text", sourceFileName: "note.txt", assetId: "original", noteContent: "", tagIds: ["tag"], collectionIds: ["collection"], createdAt: 2, updatedAt: 2 };
    const markdown: DocumentItem = { ...text, id: "markdown", format: "markdown", sourceFileName: "note.md", createdAt: 3 };
    const pdf: DocumentItem = { ...text, id: "pdf", format: "pdf", sourceFileName: "reference.pdf", createdAt: 4 };
    const items = [note, text, markdown, pdf, buildLink({ url: "https://example.com" })];
    const indexes = buildLibraryBrowseIndexes(items);
    const view = parseLibraryViewState(new URLSearchParams("type=note"));
    expect(filterAndSortLibraryItems(items, [], view, new Map(), indexes).map((item) => item.id)).toEqual(["markdown", "text", "note"]);
    expect(filterAndSortLibraryItems(items, [], { ...view, collection: "collection", tag: "tag" }, new Map(), indexes).map((item) => item.id)).toEqual(["markdown", "text"]);
    expect(filterAndSortLibraryItems(items, [], { ...view, type: "document" }, new Map(), indexes).map(item => item.id)).toEqual(["pdf", "markdown", "text"]);
    expect(countSidebarItems(items)).toMatchObject({ pdfDocuments: 1, byType: { note: 1, document: 3 } });
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
