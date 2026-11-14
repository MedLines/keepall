import Dexie from "dexie";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { buildImageFromAssetIds } from "@/domain/image";
import { buildLink } from "@/domain/link";
import { buildNote } from "@/domain/note";
import { deleteKeepallDatabase, getDb, KEEPALL_DB_NAME } from "./db";
import { backfillPreviewLayouts, loadPreviewLayouts, peekPreviewLayout, rememberPreviewLayout } from "./preview-layouts";

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

function stubImageDecoder() {
  // Each fixture blob carries its own "WIDTHxHEIGHT" so the stub can report a size without real decoding.
  const decode = vi.fn(async (blob: Blob) => {
    const [width, height] = (await blob.text()).split("x").map(Number);
    return { width, height, close: vi.fn() };
  });
  vi.stubGlobal("createImageBitmap", decode);
  return decode;
}

async function putImageAsset(id: string, size: string) {
  const bytes = new TextEncoder().encode(size);
  await getDb().assets.put({ id, bytes, mimeType: "image/png", byteLength: bytes.byteLength, contentHash: id, createdAt: 1 });
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

test("backfill learns the size of media that never finished loading", async () => {
  const decode = stubImageDecoder();
  await putImageAsset("link-preview", "1200x627");
  await putImageAsset("photo", "4000x3000");
  // fake-indexeddb does not round-trip Blobs, so serve the stored thumbnail directly.
  const thumbnail = { assetId: "photo", blob: new Blob(["640x480"], { type: "image/webp" }) };
  vi.spyOn(getDb().thumbnails, "get").mockImplementation((async (key: string) => key === "photo" ? thumbnail : undefined) as never);
  const link = { ...buildLink({ url: "https://example.com/post" }), previewAssetId: "link-preview" };
  const image = buildImageFromAssetIds({ assetIds: ["photo"] });

  expect(await backfillPreviewLayouts([link, image])).toBe(2);

  expect(peekPreviewLayout("link-preview")).toEqual({ assetId: "link-preview", width: 1200, height: 627 });
  // The grid shows an image's thumbnail, so its size comes from the thumbnail.
  expect(peekPreviewLayout("photo")).toEqual({ assetId: "photo", width: 640, height: 480 });
  expect(await getDb().previewLayouts.count()).toBe(2);
  expect(decode).toHaveBeenCalledTimes(2);
});

test("backfill skips known sizes, non-image assets and stops when cancelled", async () => {
  const decode = stubImageDecoder();
  await rememberPreviewLayout("known", 800, 400);
  await putImageAsset("first", "300x600");
  await putImageAsset("second", "600x300");
  const bytes = new TextEncoder().encode("%PDF");
  await getDb().assets.put({ id: "pdf", bytes, mimeType: "application/pdf", byteLength: bytes.byteLength, contentHash: "pdf", createdAt: 1 });
  const items = ["known", "pdf", "first", "second"].map(previewAssetId => ({ ...buildLink({ url: `https://example.com/${previewAssetId}` }), previewAssetId }));

  expect(await backfillPreviewLayouts(items, () => true)).toBe(0);
  expect(decode).not.toHaveBeenCalled();

  expect(await backfillPreviewLayouts(items)).toBe(2);
  expect(peekPreviewLayout("first")?.height).toBe(600);
  expect(peekPreviewLayout("second")?.width).toBe(600);
  expect(peekPreviewLayout("pdf")).toBeUndefined();
  expect(decode).toHaveBeenCalledTimes(2);
});

test("reloading keeps sizes learned while the read was in flight", async () => {
  const image = buildImageFromAssetIds({ assetIds: ["cover"] });
  const load = loadPreviewLayouts([image]);
  await rememberPreviewLayout("cover", 640, 360);
  await load;
  expect(peekPreviewLayout("cover")?.width).toBe(640);
});
