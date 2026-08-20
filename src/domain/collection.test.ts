import { describe, expect, test } from "vitest";
import {
  assignCollectionId,
  buildCollection,
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
  test("appends a new id once", () => {
    expect(assignCollectionId(["a"], "b")).toEqual(["a", "b"]);
    expect(assignCollectionId(["a"], "a")).toEqual(["a"]);
  });
});
