import { describe, expect, test } from "vitest";
import { buildNote } from "./note";
import {
  captureOrgDrafts,
  rankCaptureOrganizations,
} from "./capture-org";

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

  test("ranks capture choices by item count, recent use, then name", () => {
    const entries = [
      { id: "empty-z", name: "Zebra" },
      { id: "recent", name: "Recent" },
      { id: "heavy", name: "Heavy" },
      { id: "older", name: "Older" },
      { id: "empty-a", name: "Alpha" },
    ];
    const items = [
      {
        ...buildNote({ content: "Heavy one" }, { id: "n1", now: 10 }),
        collectionIds: ["heavy"],
      },
      {
        ...buildNote({ content: "Heavy two" }, { id: "n2", now: 20 }),
        collectionIds: ["heavy"],
      },
      {
        ...buildNote({ content: "Recent" }, { id: "n3", now: 100 }),
        collectionIds: ["recent"],
      },
      {
        ...buildNote({ content: "Older" }, { id: "n4", now: 80 }),
        collectionIds: ["older"],
      },
    ];

    expect(
      rankCaptureOrganizations(entries, items, "collection").map(
        (entry) => entry.id,
      ),
    ).toEqual(["heavy", "recent", "older", "empty-a", "empty-z"]);
  });

  test("uses the same ranking rule for tags", () => {
    const entries = [
      { id: "unused", name: "Unused" },
      { id: "common", name: "Common" },
      { id: "recent", name: "Recent" },
    ];
    const items = [
      {
        ...buildNote({ content: "Common one" }, { id: "n1", now: 10 }),
        tagIds: ["common"],
      },
      {
        ...buildNote({ content: "Common two" }, { id: "n2", now: 20 }),
        tagIds: ["common"],
      },
      {
        ...buildNote({ content: "Recent" }, { id: "n3", now: 100 }),
        tagIds: ["recent"],
      },
    ];

    expect(
      rankCaptureOrganizations(entries, items, "tag").map((entry) => entry.id),
    ).toEqual(["common", "recent", "unused"]);
  });
});
