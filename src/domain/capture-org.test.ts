import { describe, expect, test } from "vitest";
import { captureOrgDrafts } from "./capture-org";

describe("captureOrgDrafts", () => {
  test("trims names, drops blanks, and keeps the first duplicate", () => {
    expect(
      captureOrgDrafts(["  work  ", "", "work", "later"], "  Reading  "),
    ).toEqual({
      tagNames: ["work", "later"],
      collectionName: "Reading",
    });
  });

  test("blank collection becomes Unsorted (null)", () => {
    expect(captureOrgDrafts(["design"], "   ")).toEqual({
      tagNames: ["design"],
      collectionName: null,
    });
  });
});
