import { describe, expect, test } from "vitest";
import {
  assignTagId,
  buildTag,
  normalizeTagName,
  TagValidationError,
} from "./tag";

describe("buildTag", () => {
  test("creates a tag with a trimmed name", () => {
    expect(buildTag({ name: "  design  " }, { id: "t1", now: 10 })).toEqual({
      id: "t1",
      name: "design",
      createdAt: 10,
    });
  });

  test("rejects an empty name", () => {
    expect(() => buildTag({ name: "   " })).toThrow(TagValidationError);
  });
});

describe("normalizeTagName", () => {
  test("collapses inner whitespace", () => {
    expect(normalizeTagName("  design   systems  ")).toBe("design systems");
  });
});

describe("assignTagId", () => {
  test("appends a new id once", () => {
    expect(assignTagId(["a"], "b")).toEqual(["a", "b"]);
    expect(assignTagId(["a"], "a")).toEqual(["a"]);
  });
});
