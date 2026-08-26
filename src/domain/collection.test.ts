import { describe, expect, test } from "vitest";
import {
  assignCollectionId,
  buildCollection,
  clearCollectionId,
  coerceExclusiveCollectionIds,
  coercePinnedItemIds,
  CollectionValidationError,
  normalizeCollectionName,
  pinItemId,
  unpinItemId,
} from "./collection";

describe("buildCollection", () => {
  test("creates a collection with a trimmed name", () => {
    expect(
      buildCollection({ name: "  Reading  " }, { id: "c1", now: 10 }),
    ).toEqual({
      id: "c1",
      name: "Reading",
      createdAt: 10,
      pinnedItemIds: [],
    });
  });

  test("rejects an empty name", () => {
    expect(() => buildCollection({ name: "   " })).toThrow(
      CollectionValidationError,
    );
  });
});

describe("normalizeCollectionName", () => {
  test("collapses inner whitespace", () => {
    expect(normalizeCollectionName("  design   systems  ")).toBe(
      "design systems",
    );
  });
});

describe("assignCollectionId", () => {
  test("sets exclusive membership to the new id", () => {
    expect(assignCollectionId(["a"], "b")).toEqual(["b"]);
    expect(assignCollectionId(["a"], "a")).toEqual(["a"]);
    expect(assignCollectionId([], "c")).toEqual(["c"]);
  });
});

describe("coerceExclusiveCollectionIds", () => {
  test("keeps only the first id", () => {
    expect(coerceExclusiveCollectionIds(["a", "b", "c"])).toEqual(["a"]);
    expect(coerceExclusiveCollectionIds([])).toEqual([]);
  });
});

describe("clearCollectionId", () => {
  test("removes the matching id", () => {
    expect(clearCollectionId(["a"], "a")).toEqual([]);
    expect(clearCollectionId(["a"], "b")).toEqual(["a"]);
  });
});

describe("pinItemId", () => {
  test("appends once and keeps order", () => {
    expect(pinItemId([], "n1")).toEqual(["n1"]);
    expect(pinItemId(["n1"], "n2")).toEqual(["n1", "n2"]);
    expect(pinItemId(["n1"], "n1")).toEqual(["n1"]);
  });
});

describe("unpinItemId", () => {
  test("removes one id", () => {
    expect(unpinItemId(["n1", "n2"], "n1")).toEqual(["n2"]);
  });
});

describe("coercePinnedItemIds", () => {
  test("dedupes and drops empty strings", () => {
    expect(coercePinnedItemIds(["a", "a", "", "b"])).toEqual(["a", "b"]);
    expect(coercePinnedItemIds(undefined)).toEqual([]);
  });
});
