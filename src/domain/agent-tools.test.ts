import { describe, expect, it } from "vitest";
import {
  AgentToolError, describeItemForAgent, itemImageRefs, listCollectionsForAgent, listTagsForAgent, MAX_TEXT_CHARACTERS, nameIndex,
  parseGetItemArgs, parseSearchItemsArgs, parseViewImagesArgs, searchItemsForAgent,
} from "./agent-tools";
import type { Item } from "./item";

const base = { tagIds: [], collectionIds: [], updatedAt: 1, noteContent: "", noteFormat: "plain" as const };
const link = { ...base, previewTitle: "", previewDescription: "", previewImageUrl: "", previewAssetId: null };
const items = [
  { ...link, id: "a", type: "link", title: "Masonry layouts", url: "https://example.com/masonry", createdAt: 1, tagIds: ["t1"], collectionIds: ["c1"], previewAssetId: "preview", screenshots: [{ assetId: "shot", capturedAt: 1, width: 10, height: 10 }] },
  { ...base, id: "b", type: "note", title: "", content: "Notes about masonry grids", createdAt: 3 },
  { ...link, id: "c", type: "link", title: "Unrelated", url: "https://example.com/other", createdAt: 2 },
  { ...base, id: "d", type: "image", title: "", assetIds: ["img1", "img2"], sourceUrl: "https://example.com/source", caption: "Dashboard sidebar", createdAt: 4, collectionIds: ["c1"], analysis: [{ assetId: "img1", palette: ["#112233"], ocr: { text: "Revenue", confidence: 90, language: "eng", extractedAt: 1 } }] },
  { ...base, id: "e", type: "video", title: "Clip", sourceFileName: "clip.mp4", assetId: "vid", createdAt: 5 },
  { ...base, id: "f", type: "document", title: "Spec", format: "pdf", sourceFileName: "spec.pdf", assetId: "pdf", createdAt: 6 },
  { ...base, id: "g", type: "document", title: "Readme", format: "markdown", sourceFileName: "readme.md", assetId: "md", createdAt: 7 },
] as unknown as Item[];
const byId = (id: string) => items.find((item) => item.id === id)!;
const tags = [{ id: "t1", name: "layout", createdAt: 1 }, { id: "t2", name: "Unused", createdAt: 1 }];
const collections = [{ id: "c1", name: "Portfolio inspo", createdAt: 1, pinnedItemIds: [] }];
const origin = "http://localhost:3000";

describe("argument parsing", () => {
  it("applies defaults and rejects bad input with a message the agent can act on", () => {
    expect(parseSearchItemsArgs({ query: "x" })).toEqual({ query: "x", limit: 20 });
    expect(() => parseSearchItemsArgs({})).toThrow(AgentToolError);
    expect(() => parseSearchItemsArgs({ query: "x", type: "folder" })).toThrow("type must be one of");
    expect(() => parseSearchItemsArgs({ query: "x", limit: 51 })).toThrow("limit must be");
    expect(() => parseSearchItemsArgs({ query: "x".repeat(501) })).toThrow("at most 500");
    expect(() => parseSearchItemsArgs({ query: "x", has_images: "yes" })).toThrow("has_images");
    expect(parseGetItemArgs({ id: "a" })).toEqual({ id: "a", imageOffset: 0, maxImages: 4 });
    expect(() => parseGetItemArgs({ id: "a", max_images: 9 })).toThrow("max_images");
    expect(parseViewImagesArgs({ ids: ["a", "a", "b"] })).toEqual({ ids: ["a", "b"] });
    expect(() => parseViewImagesArgs({ ids: Array.from({ length: 13 }, (_, index) => String(index)) })).toThrow("1 to 12");
  });
});

describe("itemImageRefs", () => {
  it("lists every picture an item holds, best first and without repeats", () => {
    expect(itemImageRefs(byId("a"))).toEqual([
      { source: "asset", id: "preview", label: "Cover" },
      { source: "asset", id: "shot", label: "Screenshot 1" },
    ]);
    expect(itemImageRefs(byId("d")).map((ref) => ref.label)).toEqual(["Image 1 of 2", "Image 2 of 2"]);
    expect(itemImageRefs(byId("e"))).toEqual([{ source: "video-poster", id: "vid", label: "Video frame" }]);
    expect(itemImageRefs(byId("f"))).toEqual([{ source: "pdf-page", id: "pdf", label: "First page" }]);
    expect(itemImageRefs(byId("g"))).toEqual([]);
    expect(itemImageRefs(byId("b"))).toEqual([]);
  });
});

describe("searchItemsForAgent", () => {
  it("ranks title matches first and names tags, collections, and picture counts", () => {
    const result = searchItemsForAgent(items, tags, collections, parseSearchItemsArgs({ query: "masonry" }), origin);
    expect(result.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(result.items[0]).toMatchObject({ url: "https://example.com/masonry", tags: ["layout"], collection: "Portfolio inspo", images: 2, openInKeepall: `${origin}/items/a` });
    expect(result.items[1].excerpt).toContain("masonry grids");
  });

  it("filters by collection and tag names, ignoring case, and by pictures", () => {
    const search = (args: Record<string, unknown>) => searchItemsForAgent(items, tags, collections, parseSearchItemsArgs({ query: "", ...args }), origin).items.map((item) => item.id);
    expect(search({ collection: "portfolio INSPO" })).toEqual(["d", "a"]);
    expect(search({ tag: "Layout" })).toEqual(["a"]);
    expect(search({ has_images: true })).toEqual(["f", "e", "d", "a"]);
    expect(search({ has_images: false, type: "document" })).toEqual(["g"]);
    expect(() => search({ collection: "Nope" })).toThrow("list_collections");
    expect(() => search({ tag: "Nope" })).toThrow("list_tags");
  });
});

describe("describeItemForAgent", () => {
  const names = nameIndex(tags, collections);

  it("gives an image's caption, text found in it, and palette", () => {
    expect(describeItemForAgent(byId("d"), names, origin)).toMatchObject({
      type: "image", caption: { text: "Dashboard sidebar" }, imageText: { text: "Revenue" }, palette: ["#112233"], sourceUrl: "https://example.com/source", images: 2,
    });
  });

  it("bounds long text and says it was cut", () => {
    const long = { ...byId("b"), content: "x".repeat(MAX_TEXT_CHARACTERS + 10) } as Item;
    expect(describeItemForAgent(long, names, origin).note).toEqual({ text: "x".repeat(MAX_TEXT_CHARACTERS), truncated: true });
    expect(describeItemForAgent(byId("g"), names, origin, "# Readme")).toMatchObject({ format: "markdown", fileName: "readme.md", document: { text: "# Readme" } });
  });
});

describe("lists", () => {
  it("counts items per collection and tag", () => {
    expect(listCollectionsForAgent(items, collections)).toEqual({ collections: [{ name: "Portfolio inspo", items: 2 }], unsorted: 5 });
    expect(listTagsForAgent(items, tags)).toEqual({ tags: [{ name: "layout", items: 1 }, { name: "Unused", items: 0 }] });
  });
});
