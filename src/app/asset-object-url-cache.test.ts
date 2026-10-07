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
  peekAssetObjectUrl,
  invalidateThumbnailObjectUrl,
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

  test("exposes a ready URL without starting a read and clears it on eviction", async () => {
    expect(peekAssetObjectUrl("asset")).toBeNull();
    expect(getAsset).not.toHaveBeenCalled();
    const handle = acquireAssetObjectUrl("asset");
    expect(peekAssetObjectUrl("asset")).toBeNull();
    await handle.promise;
    expect(peekAssetObjectUrl("asset")).toBe("blob:shared-asset");
    handle.release();
    clearAssetObjectUrlCache();
    expect(peekAssetObjectUrl("asset")).toBeNull();
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

  test("refreshes a replaced thumbnail while retaining the old URL until its users release it", async () => {
    vi.mocked(URL.createObjectURL).mockReturnValueOnce("blob:old-poster").mockReturnValueOnce("blob:new-poster");
    const old = acquireThumbnailObjectUrl("video");
    await expect(old.promise).resolves.toBe("blob:old-poster");
    invalidateThumbnailObjectUrl("video");
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    const next = acquireThumbnailObjectUrl("video");
    await expect(next.promise).resolves.toBe("blob:new-poster");
    expect(getThumbnail).toHaveBeenCalledTimes(2);
    old.release();
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:old-poster");
    const another = acquireThumbnailObjectUrl("video");
    await expect(another.promise).resolves.toBe("blob:new-poster");
    expect(getThumbnail).toHaveBeenCalledTimes(2);
    next.release(); another.release();
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
