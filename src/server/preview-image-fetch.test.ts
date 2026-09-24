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

  test("accepts exactly 5 MiB and rejects a body larger than a false Content-Length", async () => {
    const assertUrl = vi.fn().mockResolvedValue(new URL("https://cdn.example.com/image.png"));
    const atLimit = new Uint8Array(MAX_PREVIEW_IMAGE_BYTES);
    const accepted = await fetchPreviewImage("https://cdn.example.com/image.png", {
      assertUrl,
      fetchImpl: vi.fn().mockResolvedValue(new Response(atLimit, {
        headers: { "Content-Type": "image/png" },
      })),
    });
    expect(accepted.bytes.byteLength).toBe(MAX_PREVIEW_IMAGE_BYTES);

    await expect(fetchPreviewImage("https://cdn.example.com/image.png", {
      assertUrl,
      fetchImpl: vi.fn().mockResolvedValue(new Response(new Uint8Array(MAX_PREVIEW_IMAGE_BYTES + 1), {
        headers: { "Content-Type": "image/png", "Content-Length": "10" },
      })),
    })).rejects.toThrow("Image too large");
  });

  test("stops a streamed image above the cap without Content-Length", async () => {
    const limit = 8;
    let canceled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(5));
        controller.enqueue(new Uint8Array(5));
      },
      cancel() { canceled = true; },
    });
    const fetchImpl = vi.fn().mockResolvedValue(new Response(stream, {
      headers: { "Content-Type": "image/png" },
    }));
    const assertUrl = vi.fn().mockResolvedValue(new URL("https://cdn.example.com/image.png"));
    await expect(fetchPreviewImage("https://cdn.example.com/image.png", {
      fetchImpl, assertUrl, maxBytes: limit,
    })).rejects.toThrow("Image too large");
    expect(canceled).toBe(true);
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
