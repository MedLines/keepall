import { describe, expect, test } from "vitest";
import {
  estimateLibraryGridItemHeight,
  gridColumnCount,
  listColumnCount,
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

  test("automatic list columns follow width while explicit choices force the count", () => {
    expect(listColumnCount(400)).toBe(1);
    expect(listColumnCount(900)).toBe(2);
    expect(listColumnCount(1400)).toBe(3);
    expect(listColumnCount(3000)).toBe(3);
    expect(listColumnCount(1400, "1")).toBe(1);
    expect(listColumnCount(1400, "2")).toBe(2);
    expect(listColumnCount(600, "3")).toBe(3);
  });

  test("estimates cards from their visible type instead of one fixed row height", () => {
    const common = {
      createdAt: 1,
      updatedAt: 1,
      tagIds: [],
      collectionIds: [],
    };
    const shortNote = estimateLibraryGridItemHeight({
      ...common,
      id: "short",
      type: "note",
      title: "Small note",
      content: "One line.",
    }, 360);
    const longNote = estimateLibraryGridItemHeight({
      ...common,
      id: "long",
      type: "note",
      title: "Long note",
      content: "A longer thought. ".repeat(40),
    }, 360);
    const linkWithoutLocalMedia = estimateLibraryGridItemHeight({
      ...common,
      id: "link",
      type: "link",
      title: "Reference",
      url: "https://example.com",
      previewStatus: "ready",
      previewTitle: "",
      previewDescription: "",
      previewImageUrl: "https://cdn.example.com/image.png",
      previewAssetId: null,
      previewRetry: "none",
      previewAttemptedAt: 1,
    }, 360);

    expect(longNote).toBeGreaterThan(shortNote);
    expect(linkWithoutLocalMedia).toBeLessThan(320);
  });
});
