import { expect, test } from "vitest";
import { contextPackSourceForSelection, contextPackSourceForView } from "./context-pack-view";

const base = { q: "", collection: null, unsorted: false, tag: null, type: null, sort: "newest" as const };

test("describes collections, tags, types, searches and sort", () => {
  expect(contextPackSourceForView({ ...base, collection: "c1", tag: "t1", type: ["link", "image"], q: " grid ", sort: "relevance" }, { collection: "Inspo", tag: "type" }))
    .toEqual({
      kind: "collection",
      description: "Collection *Inspo*, tag “type”, links, images, search “grid”, best match first",
      view: { collection: "c1", tag: "t1", type: ["link", "image"], q: "grid", sort: "relevance" },
    });
  expect(contextPackSourceForView({ ...base, tag: "t1" }, { tag: "type" })).toMatchObject({ kind: "tag", description: "Tag “type”, newest first" });
  expect(contextPackSourceForView({ ...base, unsorted: true, sort: "oldest" }, {})).toMatchObject({ kind: "unsorted", description: "Unsorted, oldest first" });
  expect(contextPackSourceForView({ ...base, q: "pdf" }, {})).toMatchObject({ kind: "search", description: "All items, search “pdf”, newest first" });
  expect(contextPackSourceForView(base, {})).toMatchObject({ kind: "library", description: "All items, newest first", view: { sort: "newest" } });
});

test("describes a selection", () => {
  expect(contextPackSourceForSelection(1, "Inspo")).toEqual({ kind: "selection", description: "1 selected item from Inspo" });
  expect(contextPackSourceForSelection(3, "All items").description).toBe("3 selected items from All items");
});
