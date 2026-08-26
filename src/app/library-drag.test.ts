import { describe, expect, test } from "vitest";
import {
  decodeLibraryDragIds,
  encodeLibraryDragIds,
  resolveLibraryDragIds,
} from "./library-drag";

describe("library-drag", () => {
  test("round-trips item id payloads", () => {
    expect(decodeLibraryDragIds(encodeLibraryDragIds(["a", "b"]))).toEqual([
      "a",
      "b",
    ]);
  });

  test("rejects invalid payloads", () => {
    expect(decodeLibraryDragIds("")).toBeNull();
    expect(decodeLibraryDragIds("{}")).toBeNull();
    expect(decodeLibraryDragIds("[]")).toBeNull();
  });

  test("drags selection when dragged item is selected", () => {
    const selected = new Set(["n1", "n2"]);
    expect(resolveLibraryDragIds("n1", selected)).toEqual(["n1", "n2"]);
  });

  test("drags one item when it is not in a non-empty selection", () => {
    const selected = new Set(["n2"]);
    expect(resolveLibraryDragIds("n1", selected)).toEqual(["n1"]);
  });
});
