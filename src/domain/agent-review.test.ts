import { describe, expect, it } from "vitest";
import { planChanges, type LibraryState } from "./agent-changes";
import { agentDisplayName, decisionRequests, effectLabel, effectsByItem, groupEffects, reviewSummary, suggestedDecision } from "./agent-review";
import type { Item } from "./item";

const image = (id: string, extra: Partial<Item> = {}) =>
  ({ id, type: "image", title: "", assetIds: [`${id}-asset`], sourceUrl: "https://www.pinterest.com/pin/1", caption: "", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1, ...extra }) as unknown as Item;
const state = (): LibraryState => ({ items: [image("a"), image("b"), image("c", { tagIds: ["dark"] })], collections: [], tags: [{ id: "dark", name: "Dark UI", createdAt: 1 }] });
let counter = 0;
const plan = (inputs: Parameters<typeof planChanges>[1], excluded?: Set<string>) => planChanges(state(), inputs, { now: 10, newId: () => `id-${(counter += 1)}`, excluded });

describe("agentDisplayName", () => {
  it("turns client names into product names", () => {
    expect(agentDisplayName("claude-code")).toBe("Claude Code");
    expect(agentDisplayName("my-local_agent")).toBe("My Local Agent");
    expect(agentDisplayName("Zed Assistant")).toBe("Zed Assistant");
  });
});

describe("effects", () => {
  it("lists one effect per item, and a tag suggested twice applies and shows once", () => {
    const result = plan([
      { id: "r1", request: { kind: "tag", itemIds: ["a", "b", "c"], add: ["dark ui"], remove: [] } },
      { id: "r2", request: { kind: "tag", itemIds: ["a", "b"], add: ["dark ui", "cards"], remove: [] } },
    ]);
    expect(result.steps[0].effects.map((effect) => effect.key)).toEqual(["a#tag:add:dark ui", "b#tag:add:dark ui"]);
    expect(result.steps[1].effects.map((effect) => effect.key)).toEqual(["a#tag:add:cards", "b#tag:add:cards"]);
    const groups = groupEffects(result.steps.map((step, index) => ({ ...step, reason: index ? "They show card layouts" : undefined })));
    expect(groups.map((group) => [group.title, group.itemIds])).toEqual([["Add tag “Dark UI”", ["a", "b"]], ["Add tag “cards”", ["a", "b"]]]);
    expect(groups[1].reasons).toEqual(["They show card layouts"]);
    expect(effectsByItem(groups).get("a")?.map(effectLabel)).toEqual(["+ Dark UI", "+ cards"]);
    expect(reviewSummary(groups)).toMatchObject({ items: 2, effects: 4, tags: 2 });
  });

  it("leaves out exactly what the reviewer unticked", () => {
    const result = plan([
      { id: "r1", request: { kind: "move", itemIds: ["a", "b"], collection: "Moodboard" } },
      { id: "r2", request: { kind: "tag", itemIds: ["a", "b"], add: ["cards"], remove: [] } },
      { id: "r3", request: { kind: "save_note", text: "Summary", tags: [] } },
      { id: "r4", request: { kind: "trash", itemIds: ["c"] } },
    ], new Set(["b#collection", "a#tag:add:cards", "create:r3", "c#trash"]));
    const touched = (id: string) => result.records.find((record) => record.id === id)?.after as Item | undefined;
    expect(touched("a")?.collectionIds).toHaveLength(1);
    expect(touched("a")?.tagIds).toEqual([]);
    expect(touched("b")?.collectionIds).toEqual([]);
    expect(touched("b")?.tagIds).toHaveLength(1);
    expect(touched("c")).toBeUndefined();
    expect(result.steps.map((step) => step.status)).toEqual(["planned", "planned", "excluded", "excluded"]);
    expect(result.created.items).toEqual([]);
  });

  it("flags trash and replaced notes for a second look", () => {
    const result = plan([
      { id: "r1", request: { kind: "note", itemId: "a", text: "New text", replace: true } },
      { id: "r2", request: { kind: "trash", itemIds: ["b"] } },
    ]);
    expect(groupEffects(result.steps).map((group) => [group.kind, group.caution])).toEqual([["note", false], ["trash", true]]);
  });
});

describe("item decisions", () => {
  const names = { collections: new Map([["c1", "Old"]]), tags: new Map([["dark", "Dark UI"], ["t2", "keep"]]) };
  const item = image("x", { collectionIds: ["c1"], tagIds: ["t2"] });

  it("starts from the agent's suggestion", () => {
    const effects = [
      { kind: "collection", key: "k1", itemId: "x", to: "Moodboard", isNew: true },
      { kind: "tag", key: "k2", itemId: "x", tag: "cards", op: "add" },
      { kind: "tag", key: "k3", itemId: "x", tag: "keep", op: "remove" },
      { kind: "note", key: "k4", itemId: "x", before: "", after: "Agent note" },
    ] as const;
    expect(suggestedDecision(item, effects, names)).toEqual({ collection: "Moodboard", tags: ["cards"], note: "Agent note", trash: false });
  });

  it("turns the reviewer's decision into requests the planner applies", () => {
    const requests = decisionRequests(item, { collection: null, tags: ["keep", "cards"], note: null, trash: true }, names.tags);
    expect(requests).toEqual([
      { kind: "move", itemIds: ["x"], collection: null },
      { kind: "tag", itemIds: ["x"], add: ["cards"], remove: [] },
      { kind: "trash", itemIds: ["x"] },
    ]);
    const unchanged = decisionRequests(item, { collection: "Old", tags: ["KEEP"], note: null, trash: false }, names.tags);
    expect(planChanges({ items: [item], collections: [{ id: "c1", name: "Old", createdAt: 1, pinnedItemIds: [] }], tags: [{ id: "t2", name: "keep", createdAt: 1 }] },
      unchanged.map((request, index) => ({ id: `d${index}`, request })), { now: 5, newId: () => "n" }).records).toEqual([]);
  });
});
