import Dexie from "dexie";
import { beforeEach, expect, test } from "vitest";
import { buildImageFromAssetIds } from "@/domain/image";
import { buildNote } from "@/domain/note";
import { deleteKeepallDatabase, getDb, KEEPALL_DB_NAME } from "./db";
import { loadPreviewLayouts, peekPreviewLayout, rememberPreviewLayout } from "./preview-layouts";

beforeEach(async () => { await deleteKeepallDatabase(); await loadPreviewLayouts([]); });

test("dimension writes do not mark the library as changed for automatic backups", async () => {
  const db = getDb();
  await db.items.add(buildNote({ content: "Keep this note" }));
  const revision = await db.backupState.get("library");
  await rememberPreviewLayout("portrait", 600, 1200);
  expect(await db.backupState.get("library")).toEqual(revision);
  expect(await db.previewLayouts.get("portrait")).toEqual({ assetId: "portrait", width: 600, height: 1200 });
});

test("startup reads only small dimension records and prunes unused cache entries", async () => {
  const db = getDb();
  await rememberPreviewLayout("cover", 800, 400);
  await rememberPreviewLayout("second", 400, 800);
  await rememberPreviewLayout("removed", 600, 600);
  await rememberPreviewLayout("invalid", 0, 600);
  await loadPreviewLayouts([buildImageFromAssetIds({ assetIds: ["cover", "second"] })]);
  expect(peekPreviewLayout("cover")?.width).toBe(800);
  expect(peekPreviewLayout("second")?.height).toBe(800);
  expect(peekPreviewLayout("removed")).toBeUndefined();
  expect(await db.previewLayouts.toArray()).toHaveLength(2);
  expect(await db.assets.count()).toBe(0);
});

test("upgrades an existing library without changing its saved items", async () => {
  await deleteKeepallDatabase();
  const legacy = new Dexie(KEEPALL_DB_NAME);
  legacy.version(11).stores({ items: "id, type, createdAt", tags: "id, name", collections: "id, name", assets: "id, contentHash", preferences: "id", thumbnails: "assetId", videoAssets: "id", backupSettings: "id", backupState: "id", documentAssets: "id, contentHash" });
  const note = buildNote({ content: "Saved before the update" });
  await legacy.table("items").add(note);
  legacy.close();
  expect(await getDb().items.get(note.id)).toEqual(note);
  expect(await getDb().previewLayouts.count()).toBe(0);
});
