import { describe, expect, test } from "vitest";
import {
  gridColumnCount,
  LIBRARY_VIRTUALIZE_MIN,
} from "./library-scale";

describe("library-scale", () => {
  test("virtualize threshold is above typical small libraries", () => {
    expect(LIBRARY_VIRTUALIZE_MIN).toBeGreaterThan(20);
  });

  test("grid column count grows with container width", () => {
    expect(gridColumnCount(320)).toBe(1);
    expect(gridColumnCount(800)).toBe(2);
    expect(gridColumnCount(1200)).toBe(3);
  });
});
