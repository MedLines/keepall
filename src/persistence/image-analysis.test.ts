import { describe, expect, it } from "vitest";
import { buildImage } from "@/domain/image";
import { buildAsset, hashAssetBytes } from "@/domain/asset";
import { buildKeepallBackup, parseKeepallBackup } from "@/domain/backup";
import { getDb, deleteKeepallDatabase } from "./db";
import { saveImageAnalysis } from "./image-analysis";
import { exportKeepallBackup, importKeepallBackupReplace, importKeepallBackupMerge } from "./backup";

const ocr = { text: "Invoice 4823", confidence: 91, language: "eng" as const, extractedAt: 10 };

describe("image analysis persistence", () => {
  it("merges results into current edits and rejects removed or trashed originals", async () => {
    const item = buildImage({ assetId: "a", title: "edited" }, { id: "image" });
    await getDb().items.put(item);
    await saveImageAnalysis(item.id, { assetId: "a", palette: ["#FF0000"] });
    const result = await saveImageAnalysis(item.id, { assetId: "a", ocr });
    expect(result.title).toBe("edited");
    expect(result.analysis).toEqual([{ assetId: "a", palette: ["#FF0000"], ocr }]);
    await expect(saveImageAnalysis(item.id, { assetId: "gone", ocr })).rejects.toThrow(/removed/);
    await getDb().items.put({ ...result, deletedAt: 1 });
    await expect(saveImageAnalysis(item.id, { assetId: "a", ocr })).rejects.toThrow(/not found/);
  });
  it("round trips metadata and original bytes through replace and remaps them during merge", async () => {
    const db = getDb();
    const asset = buildAsset({ bytes: new Uint8Array([1, 2, 3]), mimeType: "image/png" }, { id: "original" });
    const image = { ...buildImage({ assetId: asset.id }, { id: "image", now: 100 }), analysis: [{ assetId: asset.id, palette: ["#FF0000"], ocr }] };
    await db.assets.put(asset);
    await db.items.put(image);
    const backup = await exportKeepallBackup();
    await deleteKeepallDatabase();
    await importKeepallBackupReplace(backup);
    expect((await getDb().items.get(image.id))).toEqual(image);
    expect(Array.from((await getDb().assets.get(asset.id))!.bytes)).toEqual([1, 2, 3]);
    await deleteKeepallDatabase();
    await getDb().assets.put({ ...asset, id: "deduplicated", contentHash: await hashAssetBytes(asset.bytes) });
    await importKeepallBackupMerge(backup);
    const merged = await getDb().items.get(image.id);
    expect(merged?.type === "image" && merged.analysis?.[0].assetId).toBe("deduplicated");
    expect(merged?.type === "image" && merged.assetIds).toEqual(["deduplicated"]);
  });
  it("keeps analysis attached to retained originals when same-id galleries differ", async () => {
    const oldAsset = buildAsset({ bytes: new Uint8Array([1]), mimeType: "image/png" }, { id: "old" });
    const newAsset = buildAsset({ bytes: new Uint8Array([2]), mimeType: "image/png" }, { id: "replacement" });
    const local = { ...buildImage({ assetId: newAsset.id }, { id: "same", now: 10 }), analysis: [{ assetId: newAsset.id, palette: ["#0000FF"] }] };
    await getDb().assets.bulkPut([oldAsset, newAsset]);
    await getDb().items.put(local);
    const incoming = { ...buildImage({ assetId: oldAsset.id }, { id: "same", now: 100 }), analysis: [{ assetId: oldAsset.id, ocr }] };
    const backup = buildKeepallBackup({ items: [incoming], tags: [], collections: [], assets: [{ id: "old", mimeType: "image/png", byteLength: 1, dataBase64: "AQ==", createdAt: 1 }] });
    await importKeepallBackupMerge(backup);
    const merged = await getDb().items.get("same");
    expect(merged?.type === "image" && merged.assetIds).toEqual(["replacement"]);
    expect(merged?.type === "image" && merged.analysis).toEqual(local.analysis);
  });
  it("maps metadata by content when duplicate originals have different ids", async () => {
    const asset = buildAsset({ bytes: new Uint8Array([1]), mimeType: "image/png" }, { id: "kept" });
    await getDb().assets.bulkPut([asset, { ...asset, id: "duplicate" }]);
    await getDb().items.put(buildImage({ assetId: "kept" }, { id: "same", now: 10 }));
    const incoming = { ...buildImage({ assetId: "backup" }, { id: "same", now: 100 }), analysis: [{ assetId: "backup", ocr }] };
    const backup = buildKeepallBackup({ items: [incoming], tags: [], collections: [], assets: [{ id: "backup", mimeType: "image/png", byteLength: 1, dataBase64: "AQ==", createdAt: 1 }] });
    await importKeepallBackupMerge(backup);
    const merged = await getDb().items.get("same");
    expect(merged?.type === "image" && merged.analysis).toEqual([{ assetId: "kept", ocr }]);
  });
  it("validates metadata before applying backups", () => {
    const image = { ...buildImage({ assetId: "a" }), analysis: [{ assetId: "a", ocr }] };
    const backup = buildKeepallBackup({ items: [image], tags: [], collections: [], assets: [{ id: "a", mimeType: "image/png", byteLength: 1, dataBase64: "AQ==", createdAt: 1 }] });
    expect(parseKeepallBackup(backup).items[0]).toEqual(image);
    expect(() => parseKeepallBackup({ ...backup, items: [{ ...image, analysis: [{ assetId: "bad", ocr }] }] })).toThrow(/gallery asset/);
  });
});
