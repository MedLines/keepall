import { describe, expect, test, vi } from "vitest";
import {
  fetchPreviewImage,
  isAllowedPreviewImageMime,
  MAX_PREVIEW_IMAGE_BYTES,
} from "./preview-image-fetch";
import { PreviewFetchError, PreviewUrlBlockedError } from "./preview-fetch";

describe("isAllowedPreviewImageMime", () => {
  test("allows common image types", () => {
    expect(isAllowedPreviewImageMime("image/png")).toBe(true);
    expect(isAllowedPreviewImageMime("image/jpeg; charset=binary")).toBe(true);
    expect(isAllowedPreviewImageMime("text/html")).toBe(false);
  });
});

describe("fetchPreviewImage", () => {
  test("returns bytes for an allowed image response", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(bytes, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );
    const assertUrl = vi.fn().mockResolvedValue(new URL("https://cdn.example.com/a.png"));

    const result = await fetchPreviewImage("https://cdn.example.com/a.png", {
      fetchImpl,
      assertUrl,
    });

    expect(result.mimeType).toBe("image/png");
    expect(Array.from(result.bytes)).toEqual([1, 2, 3, 4]);
  });

  test("rejects oversized images", async () => {
    const big = new Uint8Array(MAX_PREVIEW_IMAGE_BYTES + 1);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(big, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Content-Length": String(big.byteLength),
        },
      }),
    );
    const assertUrl = vi.fn().mockResolvedValue(new URL("https://cdn.example.com/big.png"));

    await expect(
      fetchPreviewImage("https://cdn.example.com/big.png", {
        fetchImpl,
        assertUrl,
      }),
    ).rejects.toBeInstanceOf(PreviewFetchError);
  });

  test("surfaces blocked URLs", async () => {
    const assertUrl = vi
      .fn()
      .mockRejectedValue(new PreviewUrlBlockedError("nope"));

    await expect(
      fetchPreviewImage("https://169.254.169.254/x", {
        fetchImpl: vi.fn(),
        assertUrl,
      }),
    ).rejects.toBeInstanceOf(PreviewUrlBlockedError);
  });
});
