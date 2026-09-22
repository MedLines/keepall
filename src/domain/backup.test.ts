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
import { buildImage } from "./image";

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
      version: 3,
      exportedAt: 99,
      items: [note],
      tags: [],
      collections: [],
      assets: [],
      preferences: { pinnedCollectionIds: [] },
    });
  });
});

describe("parseKeepallBackup", () => {
  test("round-trips an untitled image with its original filename separately", () => {
    const image = buildImage({ assetId: "a1", sourceFileName: "abc123.png" });
    const backup = buildKeepallBackup({
      items: [image], tags: [], collections: [],
      assets: [{ id: "a1", mimeType: "image/png", byteLength: 1, dataBase64: "AQ==", createdAt: 1 }],
    });
    expect(parseKeepallBackup(JSON.parse(JSON.stringify(backup))).items).toEqual([image]);
  });

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

  test("rejects wrong format or a future version", () => {
    expect(() => parseKeepallBackup({ ...valid, format: "other" })).toThrow(
      BackupValidationError,
    );
    expect(() => parseKeepallBackup({ ...valid, version: 4 })).toThrow(
      BackupValidationError,
    );
  });

  test("round-trips Markdown source and leaves legacy notes plain", () => {
    const markdown = buildNote(
      { content: "# Card study\n\n```tsx\nconst x = 1\n```", format: "markdown" },
      { id: "n-md", now: 1 },
    );
    const exported = buildKeepallBackup({
      items: [markdown], tags: [], collections: [], exportedAt: 2,
    });
    expect(parseKeepallBackup(JSON.parse(JSON.stringify(exported))).items[0]).toEqual(markdown);

    const legacy = parseKeepallBackup({
      ...exported,
      version: 2,
      items: [{ ...markdown, format: undefined }],
    });
    expect(legacy.items[0]).not.toHaveProperty("format");
  });

  test("rejects an unknown note format instead of changing its meaning", () => {
    expect(() => parseKeepallBackup({
      ...valid,
      items: [{ ...note, format: "html" }],
    })).toThrow(/format/);
  });

  test("migrates a version 1 backup to empty collection preferences", () => {
    const withoutPreferences: Record<string, unknown> = { ...valid };
    delete withoutPreferences.preferences;

    expect(
      parseKeepallBackup({ ...withoutPreferences, version: 1 }).preferences,
    ).toEqual({ pinnedCollectionIds: [] });
  });

  test("round-trips ordered pinned collections", () => {
    const second = buildCollection(
      { name: "Second" },
      { id: "c2", now: 2 },
    );
    const backup = buildKeepallBackup({
      items: [],
      tags: [],
      collections: [collection, second],
      preferences: { pinnedCollectionIds: [second.id, collection.id] },
      exportedAt: 10,
    });

    expect(parseKeepallBackup(backup).preferences.pinnedCollectionIds).toEqual([
      second.id,
      collection.id,
    ]);
  });

  test("rejects a pinned collection that is not in the backup", () => {
    expect(() =>
      parseKeepallBackup({
        ...valid,
        preferences: { pinnedCollectionIds: ["missing"] },
      }),
    ).toThrow(/missing collection id/);
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

  test("treats missing pinnedItemIds as empty on collections", () => {
    const parsed = parseKeepallBackup({
      format: "keepall",
      version: 1,
      exportedAt: 1,
      items: [],
      tags: [],
      collections: [
        {
          id: "c1",
          name: "Reading",
          createdAt: 1,
        },
      ],
    });
    expect(parsed.collections[0]?.pinnedItemIds).toEqual([]);
  });

  test("round-trips pinnedItemIds on collections", () => {
    const collection = {
      ...buildCollection({ name: "Reading" }, { id: "c1", now: 1 }),
      pinnedItemIds: ["n1", "n2"],
    };
    const note = {
      ...buildNote({ content: "hello" }, { id: "n1", now: 1 }),
      tagIds: [],
      collectionIds: ["c1"],
    };
    const parsed = parseKeepallBackup(
      buildKeepallBackup({
        items: [note],
        tags: [],
        collections: [collection],
        exportedAt: 1,
      }),
    );
    expect(parsed.collections[0]?.pinnedItemIds).toEqual(["n1", "n2"]);
  });
});
