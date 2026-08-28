import { describe, expect, test } from "vitest";
import { isIncomingNewer, unionIds } from "./backup-merge";

describe("isIncomingNewer", () => {
  test("incoming wins only when strictly greater", () => {
    expect(isIncomingNewer(10, 11)).toBe(true);
    expect(isIncomingNewer(10, 10)).toBe(false);
    expect(isIncomingNewer(10, 9)).toBe(false);
  });
});

describe("unionIds", () => {
  test("merges lists without duplicates, keeping first order", () => {
    expect(unionIds(["a", "b"], ["b", "c"], ["a"])).toEqual(["a", "b", "c"]);
  });

  test("skips empty ids", () => {
    expect(unionIds(["a", ""], ["", "b"])).toEqual(["a", "b"]);
  });
});
