import { describe, expect, test } from "vitest";
import {
  movePinnedCollection,
  normalizePinnedCollectionIds,
  orderCollectionsByPins,
  pinCollectionId,
  unpinCollectionId,
} from "./library-preferences";

const collections = [
  { id: "alpha", name: "Alpha" },
  { id: "beta", name: "Beta" },
  { id: "gamma", name: "Gamma" },
];

describe("library collection preferences", () => {
  test("normalizes pin order against collections that still exist", () => {
    expect(
      normalizePinnedCollectionIds(
        ["beta", "missing", "beta", "alpha", ""],
        collections.map((collection) => collection.id),
      ),
    ).toEqual(["beta", "alpha"]);
  });

  test("pins at the end and removes an unpinned collection", () => {
    expect(pinCollectionId(["beta"], "alpha")).toEqual(["beta", "alpha"]);
    expect(pinCollectionId(["beta"], "beta")).toEqual(["beta"]);
    expect(unpinCollectionId(["beta", "alpha"], "beta")).toEqual(["alpha"]);
  });

  test("moves one pinned collection before another", () => {
    expect(
      movePinnedCollection(["alpha", "beta", "gamma"], "gamma", "alpha"),
    ).toEqual(["gamma", "alpha", "beta"]);
  });

  test("orders pinned collections first and leaves the rest in input order", () => {
    expect(
      orderCollectionsByPins(collections, ["gamma", "alpha"]).map(
        (collection) => collection.id,
      ),
    ).toEqual(["gamma", "alpha", "beta"]);
  });
});
