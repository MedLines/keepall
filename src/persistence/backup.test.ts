import { beforeEach, describe, expect, test, vi } from "vitest";
import { Blob as NodeBlob } from "node:buffer";
import { BackupValidationError, buildKeepallBackup, type BackupImportProgress } from "@/domain/backup";
import { buildNote, noteImageAssetIds } from "@/domain/note";
import { buildTag } from "@/domain/tag";
import {
  exportKeepallBackup,
  importKeepallBackupMerge,
  importKeepallBackupReplace,
  replaceValidatedBackup,
  libraryHasLocalData,
  countCurrentLibrary,
} from "./backup";
import { deleteKeepallDatabase, getDb } from "./db";
import { createLink, createNote, listItems, saveNoteWithImages } from "./items";
import { createTag, listTags } from "./tags";
import { createCollection, listCollections } from "./collections";
import { buildLink } from "@/domain/link";
import { buildCollection } from "@/domain/collection";
import { buildVideo } from "@/domain/video";
import { exportKeepallArchive, importKeepallArchiveReplace, prepareBackupFile } from "./backup-archive";
import {
  getLibraryPreferences,
  pinCollection,
} from "./library-preferences";

describe("backup persistence", () => {
  beforeEach(async () => {
    await deleteKeepallDatabase();
  });

  test("inspection validates the exact JSON file without changing any table", async () => {
    await createNote({ content: "keep" });
    await createTag({ name: "old" });
    const db = getDb();
    const tables = [db.items, db.tags, db.collections, db.assets, db.thumbnails, db.videoAssets, db.preferences];
    const before = await Promise.all(tables.map((table) => table.toArray()));
    const incoming = buildKeepallBackup({ items: [buildNote({ content: "incoming" }, { id: "incoming", now: 2 })], tags: [], collections: [], exportedAt: 42 });
    const file = new File([JSON.stringify(incoming)], "review.keepall.json", { type: "application/json" });
    const prepared = await prepareBackupFile(file);
    expect(prepared).toMatchObject({ name: "review.keepall.json", exportedAt: 42, counts: { total: 1, trash: 0 } });
    expect(await Promise.all(tables.map((table) => table.toArray()))).toEqual(before);
    await prepared.replace();
    expect((await listItems()).map((item) => item.id)).toEqual(["incoming"]);
    expect((await countCurrentLibrary()).total).toBe(1);
  });

  test("inspection rejects damaged JSON assets before offering a commit", async () => {
    const incoming = buildKeepallBackup({ items: [], tags: [], collections: [], assets: [
      { id: "a", mimeType: "image/png", byteLength: 2, dataBase64: "AQ==", createdAt: 1 },
    ] });
    await expect(prepareBackupFile(new File([JSON.stringify(incoming)], "bad.json")))
      .rejects.toThrow(/damaged/);
    expect((await getDb().assets.count())).toBe(0);
  });

  test("prepared archive commits its decoded payload after the source file is no longer readable", async () => {
    await createNote({ content: "source" });
    const videoId = "22222222-2222-4222-8222-222222222222";
    const item = buildVideo({ assetId: videoId, fileName: "clip.mp4" }, { id: "video-item", now: 1 });
    await getDb().items.put(item);
    await getDb().videoAssets.put({ id: videoId, mimeType: "video/mp4", byteLength: 3,
      blob: new NodeBlob([new Uint8Array([1, 2, 3])], { type: "video/mp4" }) as unknown as Blob, createdAt: 1 });
    const archive = await exportKeepallArchive(30);
    const file = new File([archive], "source.keepall.zip", { type: "application/zip" });
    const prepared = await prepareBackupFile(file);
    vi.spyOn(file, "arrayBuffer").mockRejectedValue(new Error("re-read"));
    vi.spyOn(file, "slice").mockImplementation(() => { throw new Error("re-read"); });
    await deleteKeepallDatabase();
    const writeVideo = vi.spyOn(getDb().videoAssets, "bulkAdd");
    await prepared.replace();
    expect((await listItems()).length).toBe(2);
    expect(writeVideo.mock.calls[0]?.[0][0]?.blob.size).toBe(3);
    expect((await getDb().videoAssets.get(videoId))?.byteLength).toBe(3);
    expect(prepared.counts.total).toBe(2);
    expect(prepared.counts.videoAssets).toBe(1);
  });

  test("binary archive round-trips images and rejects corruption before replacement", async () => {
    const { putAsset, getAsset } = await import("./assets");
    const { setLinkPreviewAssetId } = await import("./items");
    const link = await createLink({ url: "https://example.com/archive" });
    const asset = await putAsset({ mimeType: "image/png", bytes: new Uint8Array([1, 2, 3, 4]) });
    await setLinkPreviewAssetId(link.id, asset.id);

    const archive = await exportKeepallArchive(123);
    expect(archive.type).toBe("application/zip");
    await deleteKeepallDatabase();
    await importKeepallArchiveReplace(archive);
    expect((await getAsset(asset.id))?.bytes).toEqual(new Uint8Array([1, 2, 3, 4]));

    const oldItems = await listItems();
    const damaged = new Uint8Array(await archive.arrayBuffer());
    const manifestValue = new TextDecoder().decode(damaged).indexOf('"keepall"');
    expect(manifestValue).toBeGreaterThan(0);
    damaged[manifestValue + 2] ^= 1;
    await expect(importKeepallArchiveReplace(new Blob([damaged], { type: "application/zip" })))
      .rejects.toThrow();
    expect(await listItems()).toEqual(oldItems);
    await expect(importKeepallArchiveReplace(new Blob(["bad"], { type: "application/zip" })))
      .rejects.toThrow();
    expect(await listItems()).toEqual(oldItems);
  });

  test("quota failure during replace rolls back the existing library", async () => {
    const original = await createNote({ content: "keep me" });
    const backup = await exportKeepallBackup();
    const replacement = { ...backup, items: [buildNote({ content: "new item" })] };
    const db = getDb();
    await db.previewLayouts.put({ assetId: "cached-cover", width: 400, height: 800 });
    const put = vi.spyOn(db.items, "bulkAdd").mockRejectedValueOnce(new DOMException("Storage full", "QuotaExceededError"));
    try {
      await expect(replaceValidatedBackup(replacement)).rejects.toThrow();
    } finally {
      put.mockRestore();
    }
    expect(await listItems()).toEqual([original]);
    expect(await db.previewLayouts.get("cached-cover")).toEqual({ assetId: "cached-cover", width: 400, height: 800 });
  });

  test("exportKeepallBackup snapshots current tables", async () => {
    const note = await createNote({ content: "kept" });
    const tag = await createTag({ name: "design" });

    const backup = await exportKeepallBackup(123);

    expect(backup.format).toBe("keepall");
    expect(backup.version).toBe(7);
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
    await getDb().previewLayouts.put({ assetId: "cached-cover", width: 400, height: 800 });

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
    expect(await getDb().previewLayouts.count()).toBe(0);
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

test.each(["merge", "replace"] as const)("canceling %s rolls back all writes, including Trash, preferences and organization", async (mode) => {
  const original = await createNote({ content: "Keep this original" });
  const tag = await createTag({ name: "Original tag" });
  const collection = await createCollection({ name: "Original folder" });
  await getDb().items.update(original.id, { deletedAt: 3, tagIds: [tag.id], collectionIds: [collection.id] });
  await getDb().preferences.put({ id: "library", pinnedCollectionIds: [collection.id] });
  const before = await Promise.all(getDb().tables.map(table => table.toArray()));
  const incomingTag = buildTag({ name: "Incoming tag" }, { id: "incoming-tag", now: 2 });
  const incomingCollection = buildCollection({ name: "Incoming folder" }, { id: "incoming-folder", now: 2 });
  const items = Array.from({ length: 105 }, (_, index) => ({ ...buildNote({ content: `Incoming ${index}` }, { id: `cancel-${index}`, now: 2 }), tagIds: [incomingTag.id], collectionIds: [incomingCollection.id] }));
  const backup = buildKeepallBackup({ items, tags: [incomingTag], collections: [incomingCollection], assets: [], exportedAt: 3 });
  const prepared = await prepareBackupFile(new File([JSON.stringify(backup)], "cancel.json"));
  const controller = new AbortController();
  await expect(prepared[mode]((progress) => {
    if ((progress.phase === "merging-items" || progress.phase === "restoring-items") && (progress.completed ?? 0) > 0) controller.abort();
  }, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(await Promise.all(getDb().tables.map(table => table.toArray()))).toEqual(before);
});

test.each(["merge", "replace"] as const)("prepared %s reports item progress before the transaction commits", async (mode) => {
  const items = Array.from({ length: 205 }, (_, index) => buildNote({ content: `Imported ${index}` }, { id: `incoming-${index}`, now: 2 }));
  const backup = buildKeepallBackup({ items, tags: [], collections: [] });
  const prepared = await prepareBackupFile(new File([JSON.stringify(backup)], "progress.json"));
  const progress: BackupImportProgress[] = [];
  await prepared[mode]((update) => { progress.push(update); });
  const itemProgress = progress.filter((update) => update.phase === (mode === "merge" ? "merging-items" : "restoring-items"));
  expect(itemProgress[0]).toMatchObject({ completed: 0, total: 205 });
  expect(itemProgress.at(-1)).toMatchObject({ completed: 205, total: 205 });
  expect(itemProgress.some((update) => update.completed! > 0 && update.completed! < 205)).toBe(true);
  expect(progress.at(-1)).toEqual({ phase: "saving-library" });
  expect(await getDb().items.count()).toBe(205);
});

test.each(["merge", "replace"] as const)("ZIP %s progress includes notes, videos, documents and Trash", async (mode) => {
  const { createDocument } = await import("./documents");
  const note = await createNote({ content: "Trashed note" });
  await getDb().items.update(note.id, { deletedAt: 3 });
  await createDocument({ fileName: "reference.md", bytes: new TextEncoder().encode("# Reference") });
  const videoId = "33333333-3333-4333-8333-333333333333";
  await getDb().items.put(buildVideo({ assetId: videoId, fileName: "clip.mp4" }, { id: "video-item", now: 1 }));
  await getDb().videoAssets.put({ id: videoId, mimeType: "video/mp4", byteLength: 3,
    blob: new NodeBlob([new Uint8Array([1, 2, 3])], { type: "video/mp4" }) as unknown as Blob, createdAt: 1 });
  const prepared = await prepareBackupFile(new File([await exportKeepallArchive()], "mixed.keepall.zip"));
  await deleteKeepallDatabase();
  const progress: BackupImportProgress[] = [];
  await prepared[mode]((update) => { progress.push(update); });
  expect(prepared.counts).toMatchObject({ total: 3, active: 2, trash: 1, documents: 1, videos: 1 });
  expect(progress.filter((update) => update.phase === (mode === "merge" ? "merging-items" : "restoring-items")).at(-1))
    .toMatchObject({ completed: 3, total: 3 });
  expect(await countCurrentLibrary()).toMatchObject({ total: 3, active: 2, trash: 1, documents: 1, videos: 1 });
});
