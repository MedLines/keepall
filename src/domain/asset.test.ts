import { describe, expect, test } from "vitest";
import {
  hashAssetBytes,
  sameContentHashMultiset,
} from "./asset";

describe("hashAssetBytes", () => {
  test("same bytes produce the same hash", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    expect(await hashAssetBytes(bytes)).toBe(await hashAssetBytes(bytes));
  });

  test("different bytes produce different hashes", async () => {
    expect(await hashAssetBytes(new Uint8Array([1]))).not.toBe(
      await hashAssetBytes(new Uint8Array([2])),
    );
  });
});

describe("sameContentHashMultiset", () => {
  test("ignores order and rejects different counts", () => {
    expect(sameContentHashMultiset(["a", "b"], ["b", "a"])).toBe(true);
    expect(sameContentHashMultiset(["a", "a"], ["a"])).toBe(false);
    expect(sameContentHashMultiset(["a"], [""])).toBe(false);
  });
});
