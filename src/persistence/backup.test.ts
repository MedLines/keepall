import { beforeEach, describe, expect, test } from "vitest";
import { BackupValidationError } from "@/domain/backup";
import { buildNote } from "@/domain/note";
import { buildTag } from "@/domain/tag";
import {
  exportKeepallBackup,
  importKeepallBackupReplace,
  libraryHasLocalData,
} from "./backup";
import { deleteKeepallDatabase, getDb } from "./db";
import { createNote, listItems } from "./items";
import { createTag, listTags } from "./tags";

describe("backup persistence", () => {
  beforeEach(async () => {
    await deleteKeepallDatabase();
  });

  test("exportKeepallBackup snapshots current tables", async () => {
    const note = await createNote({ content: "kept" });
    const tag = await createTag({ name: "design" });

    const backup = await exportKeepallBackup(123);

    expect(backup.format).toBe("keepall");
    expect(backup.version).toBe(1);
    expect(backup.exportedAt).toBe(123);
    expect(backup.items).toEqual([note]);
    expect(backup.tags).toEqual([tag]);
    expect(backup.collections).toEqual([]);
  });

  test("export → import round-trips items that lack collectionIds in IndexedDB", async () => {
    const db = getDb();
    await db.items.add({
      id: "legacy-1",
      type: "note",
      title: "",
      content: "pre-collections row",
      tagIds: [],
      createdAt: 1,
      updatedAt: 1,
    } as never);

    const backup = await exportKeepallBackup(50);
    expect(backup.items[0]?.collectionIds).toEqual([]);

    await importKeepallBackupReplace(backup);

    expect(await listItems()).toEqual([
      {
        id: "legacy-1",
        type: "note",
        title: "",
        content: "pre-collections row",
        tagIds: [],
        collectionIds: [],
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
  });

  test("importKeepallBackupReplace replaces all tables atomically", async () => {
    await createNote({ content: "old local" });
    await createTag({ name: "old-tag" });

    const tag = buildTag({ name: "fresh" }, { id: "t1", now: 1 });
    const note = {
      ...buildNote({ content: "restored" }, { id: "n1", now: 2 }),
      tagIds: ["t1"],
    };

    await importKeepallBackupReplace({
      format: "keepall",
      version: 1,
      exportedAt: 9,
      items: [note],
      tags: [tag],
      collections: [],
    });

    expect(await listItems()).toEqual([note]);
    expect(await listTags()).toEqual([tag]);
    expect(await libraryHasLocalData()).toBe(true);
  });

  test("failed validation leaves the existing library untouched", async () => {
    const existing = await createNote({ content: "keep me" });

    await expect(
      importKeepallBackupReplace({
        format: "keepall",
        version: 1,
        exportedAt: 1,
        items: [{ ...existing, tagIds: ["missing"], collectionIds: [] }],
        tags: [],
        collections: [],
      }),
    ).rejects.toBeInstanceOf(BackupValidationError);

    expect(await listItems()).toEqual([existing]);
  });

  test("transaction failure after clear does not leave an empty library", async () => {
    const existing = await createNote({ content: "keep me" });
    const db = getDb();
    const tag = buildTag({ name: "ok" }, { id: "t1", now: 1 });
    const note = {
      ...buildNote({ content: "incoming" }, { id: "n1", now: 2 }),
      tagIds: ["t1"],
    };

    const originalBulkAdd = db.items.bulkAdd.bind(db.items);
    db.items.bulkAdd = (async () => {
      throw new Error("forced write failure");
    }) as unknown as typeof db.items.bulkAdd;

    try {
      await expect(
        importKeepallBackupReplace({
          format: "keepall",
          version: 1,
          exportedAt: 1,
          items: [note],
          tags: [tag],
          collections: [],
        }),
      ).rejects.toThrow("forced write failure");
    } finally {
      db.items.bulkAdd = originalBulkAdd;
    }

    expect(await listItems()).toEqual([existing]);
  });
});
