import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { buildAsset } from "@/domain/asset";
import { buildNote } from "@/domain/note";
import { deleteKeepallDatabase, getDb } from "./db";
import { deleteAsset, getAsset, putAsset } from "./assets";
import { createLink, deleteItem, permanentlyDeleteItem, setLinkPreviewAssetId } from "./items";

describe("assets persistence", () => {
  beforeEach(async () => {
    await deleteKeepallDatabase();
  });
  afterEach(() => vi.restoreAllMocks());

  test("putAsset stores bytes that getAsset returns", async () => {
    const bytes = new Uint8Array([9, 8, 7]);
    const asset = await putAsset({ mimeType: "image/png", bytes });
    const loaded = await getAsset(asset.id);

    expect(loaded?.mimeType).toBe("image/png");
    expect(loaded?.byteLength).toBe(3);
    expect(Array.from(loaded?.bytes ?? [])).toEqual([9, 8, 7]);
    expect(loaded?.contentHash).toHaveLength(64);
  });

  test("putAsset reuses a row with the same content hash", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const first = await putAsset({ mimeType: "image/png", bytes });
    const second = await putAsset({
      mimeType: "image/png",
      bytes: new Uint8Array([1, 2, 3]),
    });
    expect(second.id).toBe(first.id);
  });

  test.each(["commit", "abort"])("legacy image hashing stays in its caller's transaction on %s", async (outcome) => {
    const db = getDb();
    const legacy = buildAsset({ mimeType: "image/png", bytes: new Uint8Array([4, 5, 6]) });
    await db.assets.put(legacy);
    const original = await db.assets.get(legacy.id);
    const revision = await db.backupState.get("library");
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    vi.spyOn(crypto.subtle, "digest").mockImplementationOnce(async (...args) => {
      await new Promise(resolve => setTimeout(resolve, 20));
      return digest(...args);
    });
    const note = buildNote({ content: "Saved with the hash" });
    const write = db.transaction("rw", db.items, db.assets, async () => {
      const asset = await getAsset(legacy.id);
      expect(asset?.contentHash).toHaveLength(64);
      await db.items.put(note);
      if (outcome === "abort") throw new DOMException("Quota", "QuotaExceededError");
    });
    if (outcome === "abort") {
      await expect(write).rejects.toThrow("Quota");
      expect(await db.assets.get(legacy.id)).toEqual(original);
      expect(await db.items.count()).toBe(0);
      expect(await db.backupState.get("library")).toEqual(revision);
    } else {
      await write;
      expect((await db.assets.get(legacy.id))?.contentHash).toHaveLength(64);
      expect(await db.items.get(note.id)).toEqual(note);
    }
  });

  test("deleteItem removes a linked preview asset", async () => {
    const link = await createLink({ url: "https://example.com" });
    const asset = await putAsset({
      mimeType: "image/png",
      bytes: new Uint8Array([1]),
    });
    await setLinkPreviewAssetId(link.id, asset.id);

    await deleteItem(link.id);
    await permanentlyDeleteItem(link.id);

    expect(await getAsset(asset.id)).toBeUndefined();
  });

  test("deleteAsset removes a row", async () => {
    const asset = await putAsset({
      mimeType: "image/jpeg",
      bytes: new Uint8Array([2]),
    });
    await deleteAsset(asset.id);
    expect(await getAsset(asset.id)).toBeUndefined();
  });
});
