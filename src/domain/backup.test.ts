import { describe, expect, test } from "vitest";
import {
  BackupValidationError,
  buildKeepallBackup,
  parseKeepallBackup,
} from "./backup";
import { buildCollection } from "./collection";
import { buildLink } from "./link";
import { buildNote } from "./note";
import { buildTag } from "./tag";

describe("buildKeepallBackup", () => {
  test("wraps records with format and version", () => {
    const note = buildNote({ content: "hello" }, { id: "n1", now: 1 });
    const backup = buildKeepallBackup({
      items: [note],
      tags: [],
      collections: [],
      exportedAt: 99,
    });

    expect(backup).toEqual({
      format: "keepall",
      version: 1,
      exportedAt: 99,
      items: [note],
      tags: [],
      collections: [],
    });
  });
});

describe("parseKeepallBackup", () => {
  const tag = buildTag({ name: "design" }, { id: "t1", now: 1 });
  const collection = buildCollection({ name: "Reading" }, { id: "c1", now: 1 });
  const note = {
    ...buildNote({ content: "hello" }, { id: "n1", now: 1 }),
    tagIds: ["t1"],
    collectionIds: ["c1"],
  };

  const valid = buildKeepallBackup({
    items: [note],
    tags: [tag],
    collections: [collection],
    exportedAt: 10,
  });

  test("accepts a valid versioned backup", () => {
    expect(parseKeepallBackup(valid)).toEqual(valid);
  });

  test("rejects wrong format or version", () => {
    expect(() => parseKeepallBackup({ ...valid, format: "other" })).toThrow(
      BackupValidationError,
    );
    expect(() => parseKeepallBackup({ ...valid, version: 2 })).toThrow(
      BackupValidationError,
    );
  });

  test("rejects duplicate ids", () => {
    expect(() =>
      parseKeepallBackup({
        ...valid,
        tags: [tag, { ...tag, name: "dup" }],
      }),
    ).toThrow(/Duplicate tag id/);
  });

  test("rejects dangling tag references", () => {
    expect(() =>
      parseKeepallBackup({
        ...valid,
        items: [{ ...note, tagIds: ["missing"] }],
      }),
    ).toThrow(/missing tag id/);
  });

  test("rejects invalid link URLs", () => {
    const link = buildLink(
      { url: "https://example.com" },
      { id: "l1", now: 1 },
    );
    expect(() =>
      parseKeepallBackup({
        ...valid,
        items: [
          {
            ...link,
            url: "javascript:alert(1)",
            tagIds: [],
            collectionIds: [],
          },
        ],
      }),
    ).toThrow(/http or https/);
  });

  test("treats missing tagIds and collectionIds as empty arrays", () => {
    const bareNote = buildNote({ content: "old row" }, { id: "n2", now: 1 });
    const { tagIds: _t, collectionIds: _c, ...withoutOrg } = bareNote;

    const parsed = parseKeepallBackup({
      format: "keepall",
      version: 1,
      exportedAt: 1,
      items: [withoutOrg],
      tags: [],
      collections: [],
    });

    expect(parsed.items[0]?.tagIds).toEqual([]);
    expect(parsed.items[0]?.collectionIds).toEqual([]);
  });
});
