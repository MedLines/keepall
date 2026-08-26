import { describe, expect, test } from "vitest";
import {
  assignCollectionId,
  buildCollection,
  clearCollectionId,
  coerceExclusiveCollectionIds,
  CollectionValidationError,
  normalizeCollectionName,
} from "./collection";

describe("buildCollection", () => {
  test("creates a collection with a trimmed name", () => {
    expect(
      buildCollection({ name: "  Reading  " }, { id: "c1", now: 10 }),
    ).toEqual({
      id: "c1",
      name: "Reading",
      createdAt: 10,
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
