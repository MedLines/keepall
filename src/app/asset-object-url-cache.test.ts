import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const getAsset = vi.hoisted(() => vi.fn());
const getThumbnail = vi.hoisted(() => vi.fn());

vi.mock("@/persistence/assets", () => ({
  getAsset,
  assetToBlob: () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
}));

vi.mock("@/persistence/thumbnails", () => ({ getThumbnail }));

import {
  acquireAssetObjectUrl,
  acquireThumbnailObjectUrl,
  clearAssetObjectUrlCache,
} from "./asset-object-url-cache";

describe("asset object URL cache", () => {
  beforeEach(() => {
    clearAssetObjectUrlCache();
    getAsset.mockReset();
    getAsset.mockResolvedValue({ id: "asset" });
    getThumbnail.mockReset();
    getThumbnail.mockResolvedValue(new Blob([new Uint8Array([4, 5])], { type: "image/webp" }));
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:shared-asset");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  afterEach(() => {
    clearAssetObjectUrlCache();
    vi.restoreAllMocks();
  });

  test("shares thumbnail URLs across mounts without reading originals", async () => {
    const first = acquireThumbnailObjectUrl("asset");
    const second = acquireThumbnailObjectUrl("asset");
    await expect(first.promise).resolves.toBe("blob:shared-asset");
    await expect(second.promise).resolves.toBe("blob:shared-asset");
    expect(getThumbnail).toHaveBeenCalledTimes(1);
    expect(getAsset).not.toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    first.release();
    second.release();
    const remount = acquireThumbnailObjectUrl("asset");
    await expect(remount.promise).resolves.toBe("blob:shared-asset");
    expect(getThumbnail).toHaveBeenCalledTimes(1);
    remount.release();
  });

  test("deduplicates reads and object URLs across concurrent card mounts", async () => {
    const first = acquireAssetObjectUrl("asset");
    const second = acquireAssetObjectUrl("asset");

    await expect(first.promise).resolves.toBe("blob:shared-asset");
    await expect(second.promise).resolves.toBe("blob:shared-asset");
    expect(getAsset).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    first.release();
    second.release();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    const remounted = acquireAssetObjectUrl("asset");
    await expect(remounted.promise).resolves.toBe("blob:shared-asset");
    expect(getAsset).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    remounted.release();
  });
});
