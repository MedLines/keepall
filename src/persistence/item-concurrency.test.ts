import Dexie from "dexie";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { buildImage, type ImageItem } from "@/domain/image";
import { buildLink } from "@/domain/link";
import { buildAsset } from "@/domain/asset";
import { enrichLinkPreview } from "@/app/enrich-link-preview";
import * as thumbnails from "./thumbnails";
import { deleteKeepallDatabase, getDb } from "./db";
import { saveImageAnalysis } from "./image-analysis";
import { saveLinkArticle } from "./articles";
import {
  clearCollectionOnItem, setItemTagIds, updateImage, updateLink,
  saveLinkPreviewResult, setLinkPreviewAssetId, setLinkPreviewPending, setLinkPreviewRetry,
  replaceImageAssetAtIndex, removeImageAssetAtIndex, saveLinkPreviewImage,
  assignTagToItem, unassignTagFromItem, assignCollectionToItem,
} from "./items";

beforeEach(deleteKeepallDatabase);
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

// Schedule a competing real IndexedDB write immediately after the editor's read.
// A read/write transaction holds that write until the editor commits. Without
// one, the competitor completes first and a stale whole-row put erases it.
function competeAfterRead(id: string, write: () => Promise<unknown>) {
  const table = getDb().items;
  const get = table.get.bind(table);
  let pending: Promise<unknown> | undefined;
  let first = true;
  vi.spyOn(table, "get").mockImplementation(((key: string) => {
    const locked = !!Dexie.currentTransaction;
    return get(key).then(async snapshot => {
      if (first && key === id) {
        first = false;
        pending = Dexie.ignoreTransaction(write);
        if (!locked) await pending;
      }
      return snapshot;
    });
  }) as typeof table.get);
  return async () => { await pending; };
}

const article = { title: "Saved story", text: "Readable offline content", sourceUrl: "https://example.com/", capturedAt: 1 };
const ocr = { text: "Receipt 4823", confidence: 91, language: "eng" as const, extractedAt: 1 };

test("image editing preserves OCR that competes after its read", async () => {
  const item = buildImage({ assetId: "original" }, { id: "image" });
  await getDb().items.put(item);
  const finish = competeAfterRead(item.id, () => saveImageAnalysis(item.id, { assetId: "original", ocr }));
  await updateImage(item.id, { title: "Edited" });
  await finish();
  expect(await getDb().items.get(item.id)).toMatchObject({ title: "Edited", analysis: [{ assetId: "original", ocr }] });
});

test.each([
  ["link edit", (id: string) => updateLink(id, { url: article.sourceUrl, title: "Edited" })],
  ["pending preview", (id: string) => setLinkPreviewPending(id)],
  ["preview metadata", (id: string) => saveLinkPreviewResult(id, { status: "ready", title: "Website", description: "Description", imageUrl: "" })],
  ["preview retry", (id: string) => setLinkPreviewRetry(id, "network")],
  ["preview asset", (id: string) => setLinkPreviewAssetId(id, "preview")],
  ["tag edit", (id: string) => setItemTagIds(id, ["tag"])],
  ["tag assignment", (id: string) => assignTagToItem(id, "tag")],
  ["tag removal", (id: string) => unassignTagFromItem(id, "tag")],
  ["collection assignment", (id: string) => assignCollectionToItem(id, "collection")],
  ["collection edit", (id: string) => clearCollectionOnItem(id)],
] as const)("%s preserves an article captured after its read", async (_name, edit) => {
  const item = buildLink({ url: article.sourceUrl }, { id: "link" });
  await getDb().tags.put({ id: "tag", name: "Review", createdAt: 1 });
  await getDb().collections.put({ id: "collection", name: "Reading", createdAt: 1, pinnedItemIds: [] });
  await getDb().items.put(item);
  const finish = competeAfterRead(item.id, () => saveLinkArticle(item.id, item.url, article));
  await edit(item.id);
  await finish();
  expect(await getDb().items.get(item.id)).toMatchObject({ article });
});

test("gallery replacement keeps edits and analysis committed during thumbnail preparation", async () => {
  const db = getDb();
  await db.assets.bulkPut(["first", "retained"].map((id, index) => buildAsset({ mimeType: "image/png", bytes: new Uint8Array([index]) }, { id })));
  const gallery: ImageItem = { ...buildImage({ assetId: "first" }, { id: "image" }), assetIds: ["first", "retained"] };
  await db.items.put(gallery);
  let finishThumbnail!: (blob: null) => void;
  const thumbnail = vi.spyOn(thumbnails, "imageThumbnail").mockImplementation(() => new Promise(resolve => { finishThumbnail = resolve; }));
  const replacement = replaceImageAssetAtIndex("image", 0, { bytes: new Uint8Array([3]), mimeType: "image/png" });
  await vi.waitFor(() => expect(thumbnail).toHaveBeenCalled());
  await saveImageAnalysis("image", { assetId: "retained", ocr });
  await updateImage("image", { title: "Edited while preparing" });
  finishThumbnail(null);
  await replacement;
  expect(await db.items.get("image")).toMatchObject({ title: "Edited while preparing", analysis: [{ assetId: "retained", ocr }] });
  expect(await db.assets.get("first")).toBeUndefined();
  expect(await db.assets.get("retained")).toBeDefined();
});

test.each(["metadata", "image"] as const)("delayed preview %s cannot modify a changed URL or leak an asset", async phase => {
  const item = buildLink({ url: article.sourceUrl }, { id: "link" });
  await getDb().items.put(item);
  let release!: (response: Response) => void;
  const response = new Promise<Response>(resolve => { release = resolve; });
  const fetcher = vi.fn(async (path: string) => {
    if (phase === "metadata" || path === "/api/preview-image") return response;
    return { ok: true, json: async () => ({ title: "Old website", imageUrl: "https://example.com/image.png" }) } as Response;
  });
  vi.stubGlobal("fetch", fetcher);
  const enrichment = enrichLinkPreview(item.id, item.url);
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(phase === "metadata" ? 1 : 2));
  const changed = await updateLink(item.id, { url: "https://new.example.com/", title: "New website", noteContent: "Keep my notes" });
  const saved = await saveLinkArticle(item.id, changed.url, { ...article, sourceUrl: changed.url });
  release({ ok: true, headers: new Headers({ "content-type": "image/png" }), blob: async () => new Blob([new Uint8Array([1, 2, 3])]), json: async () => ({ title: "Old website", imageUrl: "" }) } as Response);
  await enrichment;
  expect(await getDb().items.get(item.id)).toEqual(saved);
  expect(await getDb().assets.count()).toBe(0);
});

test("replacement cannot target a different slide removed during preparation", async () => {
  const db = getDb();
  await db.assets.bulkPut(["first", "retained"].map((id, index) => buildAsset({ mimeType: "image/png", bytes: new Uint8Array([index]) }, { id })));
  const gallery: ImageItem = { ...buildImage({ assetId: "first" }, { id: "image" }), assetIds: ["first", "retained"] };
  await db.items.put(gallery);
  let finishThumbnail!: (blob: null) => void;
  const thumbnail = vi.spyOn(thumbnails, "imageThumbnail").mockImplementation(() => new Promise(resolve => { finishThumbnail = resolve; }));
  const replacement = replaceImageAssetAtIndex("image", 0, { bytes: new Uint8Array([3]), mimeType: "image/png" });
  // Attach the rejection handler before releasing the deferred work.
  const rejected = expect(replacement).rejects.toThrow(/slide changed/);
  await vi.waitFor(() => expect(thumbnail).toHaveBeenCalled());
  const retained = await removeImageAssetAtIndex("image", 0);
  finishThumbnail(null);
  await rejected;
  expect(await db.items.get("image")).toEqual(retained);
  expect((await db.assets.toArray()).map(asset => asset.id)).toEqual(["retained"]);
});

test("preview image bytes and reference roll back together for a trashed link", async () => {
  const item = { ...buildLink({ url: article.sourceUrl }, { id: "link" }), deletedAt: 1 };
  await getDb().items.put(item);
  await expect(saveLinkPreviewImage(item.id, item.url, { bytes: new Uint8Array([1]), mimeType: "image/png" })).rejects.toThrow("Link not found");
  expect(await getDb().assets.count()).toBe(0);
});

test("edits and background results advance timestamps even when the clock stays fixed", async () => {
  vi.spyOn(Date, "now").mockReturnValue(100);
  const item = buildLink({ url: article.sourceUrl }, { id: "link", now: 100 });
  await getDb().items.put(item);
  await getDb().tags.put({ id: "review", name: "Review", createdAt: 1 });
  expect((await assignTagToItem(item.id, "review")).updatedAt).toBe(101);
  expect((await unassignTagFromItem(item.id, "review")).updatedAt).toBe(102);
  expect((await assignTagToItem(item.id, "review")).updatedAt).toBe(103);
  expect((await updateLink(item.id, { url: item.url, title: "Edited" })).updatedAt).toBe(104);
  expect((await setLinkPreviewRetry(item.id, "network")).updatedAt).toBe(105);
  expect((await saveLinkArticle(item.id, item.url, article)).updatedAt).toBe(106);
  const image = buildImage({ assetId: "original" }, { id: "image", now: 200 });
  await getDb().items.put(image);
  expect((await updateImage(image.id, { title: "Edited" })).updatedAt).toBe(201);
  expect((await saveImageAnalysis(image.id, { assetId: "original", ocr })).updatedAt).toBe(202);
});
