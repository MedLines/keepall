import { beforeEach, describe, expect, test } from "vitest";
import { BackupValidationError } from "@/domain/backup";
import { buildNote, noteImageAssetIds } from "@/domain/note";
import { buildTag } from "@/domain/tag";
import {
  exportKeepallBackup,
  importKeepallBackupMerge,
  importKeepallBackupReplace,
  libraryHasLocalData,
} from "./backup";
import { deleteKeepallDatabase, getDb } from "./db";
import { createLink, createNote, listItems, saveNoteWithImages } from "./items";
import { createTag, listTags } from "./tags";
import { createCollection, listCollections } from "./collections";
import { buildLink } from "@/domain/link";
import { buildCollection } from "@/domain/collection";
import {
  getLibraryPreferences,
  pinCollection,
} from "./library-preferences";

describe("backup persistence", () => {
  beforeEach(async () => {
    await deleteKeepallDatabase();
  });

  test("exportKeepallBackup snapshots current tables", async () => {
    const note = await createNote({ content: "kept" });
    const tag = await createTag({ name: "design" });

    const backup = await exportKeepallBackup(123);

    expect(backup.format).toBe("keepall");
    expect(backup.version).toBe(5);
    expect(backup.exportedAt).toBe(123);
    expect(backup.items).toEqual([note]);
    expect(backup.tags).toEqual([tag]);
    expect(backup.collections).toEqual([]);
    expect(backup.assets).toEqual([]);
    expect(backup.preferences).toEqual({ pinnedCollectionIds: [] });
  });

  test("export and replace import keep Markdown note source and format", async () => {
    const source = "# Design note\n\n- [ ] Check image quality\n";
    const note = await createNote({ content: source, format: "markdown" });

    const backup = await exportKeepallBackup(124);
    await importKeepallBackupReplace(backup);

    expect(await listItems()).toEqual([note]);
    expect(backup.items[0]).toMatchObject({
      content: source,
      format: "markdown",
    });
  });

  test("inline note image survives replace and merge imports", async () => {
    const note = await createNote({ content: "Before\n\nAfter", format: "markdown" });
    const saved = await saveNoteWithImages(note.id, {
      content: "Before\n\n![Image](keepall-image:pending)\n\nAfter",
      format: "markdown",
    }, [{ id: "pending", bytes: new Uint8Array([1, 2, 3]), mimeType: "image/png" }]);
    const backup = await exportKeepallBackup();
    await importKeepallBackupReplace(backup);
    expect((await listItems())[0]).toEqual(saved);

    await deleteKeepallDatabase();
    await importKeepallBackupMerge(backup);
    const restored = (await listItems())[0];
    expect(restored?.type).toBe("note");
    if (restored?.type !== "note") throw new Error("Expected note");
    expect(noteImageAssetIds(restored.content)).toHaveLength(1);
    expect((await getDb().assets.get(noteImageAssetIds(restored.content)[0]!))?.byteLength).toBe(3);
  });

  test("export and replace import preserve pinned collection order", async () => {
    const alpha = await createCollection({ name: "Alpha" });
    const beta = await createCollection({ name: "Beta" });
    await pinCollection(beta.id);
    await pinCollection(alpha.id);

    const backup = await exportKeepallBackup(125);
    await importKeepallBackupReplace(backup);

    expect((await getLibraryPreferences()).pinnedCollectionIds).toEqual([
      beta.id,
      alpha.id,
    ]);
  });

  test("export → import round-trips preview assets", async () => {
    const { createLink, setLinkPreviewAssetId, listItems } = await import(
      "./items"
    );
    const { putAsset, getAsset } = await import("./assets");

    const link = await createLink({ url: "https://example.com" });
    const asset = await putAsset({
      mimeType: "image/png",
      bytes: new Uint8Array([4, 5, 6]),
    });
    await setLinkPreviewAssetId(link.id, asset.id);

    const backup = await exportKeepallBackup(77);
    expect(backup.assets).toHaveLength(1);

    await importKeepallBackupReplace(backup);

    const restored = (await listItems())[0];
    expect(restored?.type).toBe("link");
    if (restored?.type !== "link") {
      throw new Error("expected link");
    }
    expect(restored.previewAssetId).toBe(asset.id);
    const loaded = await getAsset(asset.id);
    expect(loaded?.byteLength).toBe(3);
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
      assets: [],
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

  test("importKeepallBackupMerge adds missing notes and keeps local on second merge", async () => {
    const local = await createNote({ content: "already here" });
    const incoming = buildNote({ content: "from laptop" }, { id: "n-laptop", now: 5 });

    const { summary } = await importKeepallBackupMerge({
      format: "keepall",
      version: 1,
      exportedAt: 1,
      items: [incoming],
      tags: [],
      collections: [],
      assets: [],
    });

    expect(summary.added).toBe(1);
    const items = await listItems();
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.id).sort()).toEqual(
      [local.id, "n-laptop"].sort(),
    );

    const second = await importKeepallBackupMerge({
      format: "keepall",
      version: 1,
      exportedAt: 2,
      items: [incoming],
      tags: [],
      collections: [],
      assets: [],
    });
    expect(second.summary.added).toBe(0);
    expect(second.summary.unchanged).toBe(1);
    expect(await listItems()).toHaveLength(2);
  });

  test("merge import appends remapped pinned collections after local pins", async () => {
    const local = await createCollection({ name: "Local" });
    await pinCollection(local.id);
    const incoming = buildCollection(
      { name: "Incoming" },
      { id: "incoming-id", now: 10 },
    );

    await importKeepallBackupMerge({
      format: "keepall",
      version: 2,
      exportedAt: 20,
      items: [],
      tags: [],
      collections: [incoming],
      assets: [],
      preferences: { pinnedCollectionIds: [incoming.id] },
    });

    const mergedCollections = await listCollections();
    const mergedIncoming = mergedCollections.find(
      (collection) => collection.name === "Incoming",
    );
    expect((await getLibraryPreferences()).pinnedCollectionIds).toEqual([
      local.id,
      mergedIncoming?.id,
    ]);
  });

  test("importKeepallBackupMerge matches links by URL and applies newer title", async () => {
    const local = await createLink({
      url: "https://example.com",
      title: "Old",
    });
    await getDb().items.put({ ...local, updatedAt: 10 });

    const incoming = {
      ...buildLink(
        { url: "https://example.com/", title: "New" },
        { id: "other-device", now: 20 },
      ),
      updatedAt: 20,
    };

    const { summary } = await importKeepallBackupMerge({
      format: "keepall",
      version: 1,
      exportedAt: 3,
      items: [incoming],
      tags: [],
      collections: [],
      assets: [],
    });

    expect(summary.updated).toBe(1);
    const items = await listItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: local.id,
      type: "link",
      title: "New",
      updatedAt: 20,
    });
  });

  test("importKeepallBackupMerge unions tags and lets newer collection win", async () => {
    const work = await createTag({ name: "work" });
    const reading = await createCollection({ name: "Reading" });
    const local = await createLink({ url: "https://tagged.example" });
    await getDb().items.put({
      ...local,
      tagIds: [work.id],
      collectionIds: [reading.id],
      updatedAt: 10,
    });

    const design = buildTag({ name: "design" }, { id: "t-design", now: 1 });
    const later = buildCollection({ name: "Later" }, { id: "c-later", now: 1 });
    const incoming = {
      ...buildLink({ url: "https://tagged.example" }, { id: "l2", now: 20 }),
      tagIds: ["t-design"],
      collectionIds: ["c-later"],
      updatedAt: 20,
    };

    await importKeepallBackupMerge({
      format: "keepall",
      version: 1,
      exportedAt: 4,
      items: [incoming],
      tags: [design],
      collections: [later],
      assets: [],
    });

    const tags = await listTags();
    expect(tags.map((tag) => tag.name).sort()).toEqual(["design", "work"]);
    const collections = await listCollections();
    expect(collections.map((c) => c.name).sort()).toEqual(["Later", "Reading"]);

    const [item] = await listItems();
    expect(item?.type).toBe("link");
    if (item?.type !== "link") {
      throw new Error("expected link");
    }
    const tagNames = tags
      .filter((tag) => item.tagIds.includes(tag.id))
      .map((tag) => tag.name)
      .sort();
    expect(tagNames).toEqual(["design", "work"]);
    const collection = collections.find((c) => c.id === item.collectionIds[0]);
    expect(collection?.name).toBe("Later");
  });

  test("failed merge validation leaves the existing library untouched", async () => {
    const existing = await createNote({ content: "keep me" });

    await expect(
      importKeepallBackupMerge({
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
});
