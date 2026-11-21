import { describe, expect, it } from "vitest";
import { parseChangeRequest, planChanges, planUndo, type ChangeRequest, type LibraryState, type RecordChange } from "./agent-changes";
import type { Item } from "./item";

const base = { tagIds: [] as string[], collectionIds: [] as string[], createdAt: 1, updatedAt: 1 };
const link = (id: string, title: string, url: string, extra: Partial<Item> = {}) =>
  ({ ...base, id, type: "link", title, url, noteContent: "", previewTitle: "", previewDescription: "", previewImageUrl: "", previewAssetId: null, previewStatus: "idle", ...extra }) as unknown as Item;
const library = (): LibraryState => ({
  items: [
    link("a", "Masonry layouts", "https://example.com/masonry", { tagIds: ["t1"], collectionIds: ["c1"] }),
    link("b", "Grid systems", "https://example.com/grids"),
    { ...base, id: "n", type: "note", title: "Ideas", content: "First idea" } as unknown as Item,
    { ...base, id: "i", type: "image", title: "", assetIds: ["x"], sourceUrl: "", caption: "Hero shot" } as unknown as Item,
    link("old", "Old page", "https://example.com/old", { deletedAt: 5 }),
  ],
  collections: [{ id: "c1", name: "Research", createdAt: 1, pinnedItemIds: [] }, { id: "c2", name: "Archive", createdAt: 1, pinnedItemIds: [] }],
  tags: [{ id: "t1", name: "Layout", createdAt: 1 }],
});

let counter = 0;
const options = () => ({ now: 100, newId: () => `new-${(counter += 1)}` });
const plan = (requests: ChangeRequest[], state = library()) => planChanges(state, requests.map((request, index) => ({ id: `r${index}`, request })), options());
const after = (records: readonly RecordChange[], id: string) => records.find((record) => record.id === id)?.after as Record<string, unknown> | undefined;

/** Writes a plan's records into a library, the way persistence does. */
function apply(state: LibraryState, records: readonly RecordChange[]): LibraryState {
  const items = new Map(state.items.map((item) => [item.id, item]));
  const collections = new Map(state.collections.map((collection) => [collection.id, collection]));
  const tags = new Map(state.tags.map((tag) => [tag.id, tag]));
  for (const record of records) {
    const table = record.table === "items" ? items : record.table === "collections" ? collections : tags;
    if (record.after) (table as Map<string, unknown>).set(record.id, record.after);
    else table.delete(record.id);
  }
  return { items: [...items.values()], collections: [...collections.values()], tags: [...tags.values()] };
}

describe("parseChangeRequest", () => {
  it("accepts the shapes simpler agents send", () => {
    expect(parseChangeRequest("move_to_collection", { item_id: "a", collection: " unsorted " })).toEqual({ kind: "move", itemIds: ["a"], collection: null });
    expect(parseChangeRequest("move_to_collection", { item_ids: "a, b", collection: "Inspo" })).toEqual({ kind: "move", itemIds: ["a", "b"], collection: "Inspo" });
    expect(parseChangeRequest("tag_items", { item_ids: ["a"], tags: "one, two" })).toEqual({ kind: "tag", itemIds: ["a"], add: ["one", "two"], remove: [] });
    expect(parseChangeRequest("add_note", { item_id: "a", note: "Hi" })).toEqual({ kind: "note", itemId: "a", text: "Hi", replace: false });
    expect(parseChangeRequest("save_link", { url: "example.com", collection: "" })).toMatchObject({ kind: "save_link", url: "example.com", collection: undefined, tags: [] });
  });

  it("explains what's missing", () => {
    expect(() => parseChangeRequest("move_to_collection", { item_ids: ["a"] })).toThrow("collection is required");
    expect(() => parseChangeRequest("tag_items", { item_ids: ["a"] })).toThrow("tags to add");
    expect(() => parseChangeRequest("add_note", { item_ids: ["a", "b"], text: "x" })).toThrow("one item_id");
    expect(() => parseChangeRequest("move_to_trash", {})).toThrow("item_ids must list");
  });
});

describe("planChanges", () => {
  it("moves items, creating a collection only when something moves into it", () => {
    const result = plan([{ kind: "move", itemIds: ["a", "b"], collection: "inspo" }, { kind: "move", itemIds: ["old"], collection: "Never made" }]);
    expect(result.steps[0]).toMatchObject({ status: "planned", text: 'Move "Masonry layouts" and "Grid systems" to "inspo" (new collection)', itemIds: ["a", "b"] });
    expect(result.created.collections).toEqual(["inspo"]);
    const [collection] = result.records.filter((record) => record.table === "collections");
    expect(after(result.records, "a")).toMatchObject({ collectionIds: [collection.id], collectionAddedAt: 100, updatedAt: 100 });
    expect(result.steps[1]).toMatchObject({ status: "skipped", notes: ["old isn't in the library (it may be in Trash)"] });
  });

  it("reuses names regardless of case and reports no-ops as unchanged", () => {
    const result = plan([{ kind: "move", itemIds: ["a"], collection: "research" }, { kind: "tag", itemIds: ["a"], add: ["layout"], remove: [] }]);
    expect(result.steps.map((step) => step.status)).toEqual(["unchanged", "unchanged"]);
    expect(result.records).toEqual([]);
  });

  it("adds and removes tags, and keeps each record's original before-state across steps", () => {
    const result = plan([{ kind: "tag", itemIds: ["a", "b"], add: ["Grid"], remove: ["LAYOUT"] }, { kind: "move", itemIds: ["a"], collection: null }]);
    const tag = result.records.find((record) => record.table === "tags")!;
    expect(after(result.records, "a")).toMatchObject({ tagIds: [tag.id], collectionIds: [] });
    expect((result.records.find((record) => record.id === "a")!.before as Item).collectionIds).toEqual(["c1"]);
    expect(result.itemsAffected).toBe(2);
  });

  it("adds notes to the field each item type uses", () => {
    const result = plan([
      { kind: "note", itemId: "n", text: "Second idea", replace: false },
      { kind: "note", itemId: "i", text: "Use for the landing page", replace: false },
      { kind: "note", itemId: "b", text: "Read later", replace: true },
    ]);
    expect(after(result.records, "n")?.content).toBe("First idea\n\nSecond idea");
    expect(after(result.records, "i")?.caption).toBe("Hero shot\n\nUse for the landing page");
    expect(after(result.records, "b")?.noteContent).toBe("Read later");
  });

  it("renames collections unless the new name is taken", () => {
    const result = plan([{ kind: "rename_collection", from: "research", to: "Reading" }, { kind: "rename_collection", from: "Reading", to: "archive" }]);
    expect(after(result.records, "c1")).toMatchObject({ name: "Reading" });
    expect(result.steps[1]).toMatchObject({ status: "skipped", notes: ['A collection named "Archive" already exists. Move its items instead.'] });
  });

  it("saves new links and notes, and organizes an already saved link instead of duplicating it", () => {
    const result = plan([
      { kind: "save_link", url: "studio.example/work", title: "Studio", tags: ["inspo"], collection: "Sites" },
      { kind: "save_link", url: "https://example.com/grids", note: "Good one", tags: [] },
      { kind: "save_note", text: "Palette ideas", tags: [] },
      { kind: "save_link", url: "ftp://nope", tags: [] },
    ]);
    expect(result.created.items).toHaveLength(2);
    expect(result.steps[0].text).toBe('Save link "Studio" to "Sites" (new collection), tagged "inspo"');
    expect(result.steps[1].text).toBe('"Grid systems" is already saved: add the note');
    expect(after(result.records, "b")?.noteContent).toBe("Good one");
    expect(result.steps[3].status).toBe("skipped");
  });

  it("skips items that changed after a suggestion was made", () => {
    const result = planChanges(library(), [{ id: "r", request: { kind: "trash", itemIds: ["a", "b"] }, seen: { a: 1, b: 0 } }], options());
    expect(result.steps[0]).toMatchObject({ itemIds: ["a"], notes: ['"Grid systems" changed in Keepall after this was suggested'] });
  });
});

describe("planUndo", () => {
  it("restores what the agent changed and removes what it created", () => {
    const start = library();
    const change = plan([{ kind: "move", itemIds: ["a"], collection: "New place" }, { kind: "tag", itemIds: ["b"], add: ["fresh"], remove: [] }, { kind: "save_note", text: "Made by agent", tags: [] }], start);
    const changed = apply(start, change.records);
    const undo = planUndo(change.records, changed, 200);
    const restored = apply(changed, undo.records);
    expect(undo.kept).toEqual([]);
    expect(restored.items.find((item) => item.id === "a")).toMatchObject({ collectionIds: ["c1"], updatedAt: 200 });
    expect(restored.items.find((item) => item.id === "b")?.tagIds).toEqual([]);
    expect(restored.items.find((item) => item.id === change.created.items[0])?.deletedAt).toBe(200);
    expect(restored.collections.map((collection) => collection.name)).toEqual(["Research", "Archive"]);
    expect(restored.tags.map((tag) => tag.name)).toEqual(["Layout"]);
  });

  it("leaves anything edited since alone and says so", () => {
    const start = library();
    const change = plan([{ kind: "move", itemIds: ["a", "b"], collection: "Moved" }], start);
    const changed = apply(start, change.records);
    const edited = { ...changed, items: changed.items.map((item) => (item.id === "b" ? { ...item, tagIds: ["t1"], updatedAt: 150 } : item)) };
    const undo = planUndo(change.records, edited, 200);
    const restored = apply(edited, undo.records);
    expect(restored.items.find((item) => item.id === "a")?.collectionIds).toEqual(["c1"]);
    expect(restored.items.find((item) => item.id === "b")?.collectionIds).toHaveLength(1);
    expect(undo.kept).toEqual(['"Grid systems" was changed again after the agent\'s edit, so it was left as it is', 'Kept the new collection "Moved" because items are in it']);
  });

  it("ignores unrelated later updates, like a fetched preview", () => {
    const start = library();
    const change = plan([{ kind: "note", itemId: "b", text: "Agent note", replace: false }], start);
    const changed = apply(start, change.records);
    const previewed = { ...changed, items: changed.items.map((item) => (item.id === "b" ? { ...item, previewTitle: "Fetched", updatedAt: 300 } as Item : item)) };
    const restored = apply(previewed, planUndo(change.records, previewed, 400).records);
    expect(restored.items.find((item) => item.id === "b")).toMatchObject({ noteContent: "", previewTitle: "Fetched" });
  });
});
