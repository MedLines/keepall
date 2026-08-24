import { beforeEach, describe, expect, test } from "vitest";
import { deleteKeepallDatabase } from "./db";
import { deleteAsset, getAsset, putAsset } from "./assets";
import { createLink, deleteItem, setLinkPreviewAssetId } from "./items";

describe("assets persistence", () => {
  beforeEach(async () => {
    await deleteKeepallDatabase();
  });

  test("putAsset stores bytes that getAsset returns", async () => {
    const bytes = new Uint8Array([9, 8, 7]);
    const asset = await putAsset({ mimeType: "image/png", bytes });
    const loaded = await getAsset(asset.id);

    expect(loaded?.mimeType).toBe("image/png");
    expect(loaded?.byteLength).toBe(3);
    expect(Array.from(loaded?.bytes ?? [])).toEqual([9, 8, 7]);
  });

  test("deleteItem removes a linked preview asset", async () => {
    const link = await createLink({ url: "https://example.com" });
    const asset = await putAsset({
      mimeType: "image/png",
      bytes: new Uint8Array([1]),
    });
    await setLinkPreviewAssetId(link.id, asset.id);

    await deleteItem(link.id);

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
