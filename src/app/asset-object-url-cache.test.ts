import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const getAsset = vi.hoisted(() => vi.fn());

vi.mock("@/persistence/assets", () => ({
  getAsset,
  assetToBlob: () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
}));

import {
  acquireAssetObjectUrl,
  clearAssetObjectUrlCache,
} from "./asset-object-url-cache";

describe("asset object URL cache", () => {
  beforeEach(() => {
    clearAssetObjectUrlCache();
    getAsset.mockReset();
    getAsset.mockResolvedValue({ id: "asset" });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:shared-asset");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  afterEach(() => {
    clearAssetObjectUrlCache();
    vi.restoreAllMocks();
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
