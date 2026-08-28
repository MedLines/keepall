import { describe, expect, test } from "vitest";
import {
  LIBRARY_GRID_GAP_PX,
  LIBRARY_GRID_MIN_COL_PX,
  LIBRARY_VIRTUALIZE_MIN,
} from "./library-scale";

function gridColumnCount(containerWidth: number): number {
  return Math.max(
    1,
    Math.floor(
      (containerWidth + LIBRARY_GRID_GAP_PX) /
        (LIBRARY_GRID_MIN_COL_PX + LIBRARY_GRID_GAP_PX),
    ),
  );
}

describe("library-scale", () => {
  test("virtualize threshold is above typical small libraries", () => {
    expect(LIBRARY_VIRTUALIZE_MIN).toBeGreaterThan(20);
  });

  test("grid column count grows with container width", () => {
    expect(gridColumnCount(320)).toBe(1);
    expect(gridColumnCount(800)).toBe(3);
    expect(gridColumnCount(1200)).toBe(4);
  });
});
