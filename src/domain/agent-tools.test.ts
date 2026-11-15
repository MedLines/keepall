import { describe, expect, it } from "vitest";
import { AgentToolError, parseSearchItemsArgs, searchItemsForAgent } from "./agent-tools";
import type { Item } from "./item";

const base = { tagIds: [], collectionIds: [], updatedAt: 1, noteContent: "", noteFormat: "plain" as const };
const items = [
  { ...base, id: "a", type: "link", title: "Masonry layouts", previewTitle: "", previewDescription: "", url: "https://example.com/masonry", createdAt: 1, tagIds: ["t1"], collectionIds: ["c1"] },
  { ...base, id: "b", type: "note", title: "", content: "Notes about masonry grids", createdAt: 3 },
  { ...base, id: "c", type: "link", title: "Unrelated", previewTitle: "", previewDescription: "", url: "https://example.com/other", createdAt: 2 },
] as unknown as Item[];
const tags = [{ id: "t1", name: "layout", createdAt: 1 }];
const collections = [{ id: "c1", name: "Research", createdAt: 1, pinnedItemIds: [] }];

describe("parseSearchItemsArgs", () => {
  it("applies the default limit and rejects bad input", () => {
    expect(parseSearchItemsArgs({ query: "x" })).toEqual({ query: "x", type: undefined, limit: 20 });
    expect(() => parseSearchItemsArgs({})).toThrow(AgentToolError);
    expect(() => parseSearchItemsArgs({ query: "x", type: "folder" })).toThrow("type must be one of");
    expect(() => parseSearchItemsArgs({ query: "x", limit: 51 })).toThrow("limit must be");
    expect(() => parseSearchItemsArgs({ query: "x".repeat(501) })).toThrow("at most 500");
  });
});

describe("searchItemsForAgent", () => {
  it("ranks title matches first and names tags and collections", () => {
    const result = searchItemsForAgent(items, tags, collections, { query: "masonry", limit: 20 }, "http://localhost:3000");
    expect(result.total).toBe(2);
    expect(result.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(result.items[0]).toMatchObject({
      type: "link", title: "Masonry layouts", url: "https://example.com/masonry", tags: ["layout"], collection: "Research",
      openInKeepall: "http://localhost:3000/items/a",
    });
    expect(result.items[1].excerpt).toContain("masonry grids");
  });

  it("filters by type, limits, and lists newest first for an empty query", () => {
    expect(searchItemsForAgent(items, tags, collections, { query: "masonry", type: "note", limit: 20 }, "http://x").items.map((item) => item.id)).toEqual(["b"]);
    const newest = searchItemsForAgent(items, tags, collections, { query: "", limit: 2 }, "http://x");
    expect(newest.total).toBe(3);
    expect(newest.items.map((item) => item.id)).toEqual(["b", "c"]);
    expect(newest.items[0].excerpt).toBeUndefined();
  });
});
