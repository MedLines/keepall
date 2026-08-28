import { beforeEach, describe, expect, test, vi } from "vitest";
import { putAsset } from "@/persistence/assets";
import {
  saveLinkPreviewResult,
  setLinkPreviewAssetId,
  setLinkPreviewPending,
  setLinkPreviewRetry,
} from "@/persistence/items";
import { enrichLinkPreview } from "./enrich-link-preview";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { setPreviewEnrichPaused } from "./preview-enrich-pause";

vi.mock("@/persistence/items", () => ({
  setLinkPreviewPending: vi.fn(),
  saveLinkPreviewResult: vi.fn(),
  setLinkPreviewAssetId: vi.fn(),
  setLinkPreviewRetry: vi.fn(),
}));

vi.mock("@/persistence/assets", () => ({
  putAsset: vi.fn(),
}));

describe("enrichLinkPreview", () => {
  beforeEach(() => {
    setPreviewEnrichPaused(false);
    vi.mocked(setLinkPreviewPending).mockReset();
    vi.mocked(saveLinkPreviewResult).mockReset();
    vi.mocked(setLinkPreviewAssetId).mockReset();
    vi.mocked(setLinkPreviewRetry).mockReset();
    vi.mocked(putAsset).mockReset();
    vi.mocked(setLinkPreviewPending).mockResolvedValue({} as never);
    vi.mocked(saveLinkPreviewResult).mockResolvedValue({} as never);
    vi.mocked(setLinkPreviewAssetId).mockResolvedValue({} as never);
    vi.mocked(setLinkPreviewRetry).mockResolvedValue({} as never);
    vi.mocked(putAsset).mockResolvedValue({
      id: "a1",
      mimeType: "image/png",
      byteLength: 3,
      bytes: new Uint8Array([1, 2, 3]),
      contentHash: "abc",
      createdAt: 1,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/preview") {
          return {
            ok: true,
            json: async () => ({
              title: "Hello",
              description: "World",
              imageUrl: "https://cdn.example.com/x.png",
            }),
          };
        }
        if (url === "/api/preview-image") {
          return {
            ok: true,
            headers: { get: () => "image/png" },
            blob: async () =>
              new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
          };
        }
        return { ok: false };
      }),
    );
  });

  test("marks pending, stores metadata, then local image bytes", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    await enrichLinkPreview("l1", "https://example.com");

    expect(setLinkPreviewPending).toHaveBeenCalledWith("l1");
    expect(fetch).toHaveBeenCalledWith(
      "/api/preview",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      }),
    );
    expect(saveLinkPreviewResult).toHaveBeenCalledWith("l1", {
      status: "ready",
      title: "Hello",
      description: "World",
      imageUrl: "https://cdn.example.com/x.png",
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/preview-image",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://cdn.example.com/x.png" }),
      }),
    );
    expect(putAsset).toHaveBeenCalled();
    expect(setLinkPreviewAssetId).toHaveBeenCalledWith("l1", "a1");
    expect(
      dispatchSpy.mock.calls.some(
        ([event]) =>
          event instanceof CustomEvent &&
          event.type === ITEMS_CHANGED_EVENT &&
          event.detail?.source === "enrich",
      ),
    ).toBe(true);
  });

  test("marks failed with network retry when the preview API responds non-OK", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: "nope" }),
    } as Response);
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    await enrichLinkPreview("l1", "https://example.com");

    expect(saveLinkPreviewResult).toHaveBeenCalledWith("l1", {
      status: "failed",
      retry: "network",
    });
    expect(putAsset).not.toHaveBeenCalled();
    expect(
      dispatchSpy.mock.calls.some(
        ([event]) =>
          event instanceof CustomEvent &&
          event.type === ITEMS_CHANGED_EVENT &&
          event.detail?.source === "enrich",
      ),
    ).toBe(true);
  });

  test("skips ITEMS_CHANGED while folder navigation has paused enrich", async () => {
    setPreviewEnrichPaused(true);
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: "nope" }),
    } as Response);
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    dispatchSpy.mockClear();

    await enrichLinkPreview("l1", "https://example.com");

    expect(saveLinkPreviewResult).toHaveBeenCalledWith("l1", {
      status: "failed",
      retry: "network",
    });
    expect(
      dispatchSpy.mock.calls.some(
        ([event]) =>
          event instanceof CustomEvent &&
          event.type === ITEMS_CHANGED_EVENT &&
          event.detail?.source === "enrich",
      ),
    ).toBe(false);
  });

  test("marks failed with none when the preview URL is blocked", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "blocked" }),
    } as Response);

    await enrichLinkPreview("l1", "https://example.com");

    expect(saveLinkPreviewResult).toHaveBeenCalledWith("l1", {
      status: "failed",
      retry: "none",
    });
  });

  test("marks none when the image API rejects oversize", async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/preview") {
        return {
          ok: true,
          json: async () => ({
            title: "Hello",
            description: "World",
            imageUrl: "https://cdn.example.com/x.png",
          }),
        } as Response;
      }
      return { ok: false, status: 413 } as Response;
    });

    await enrichLinkPreview("l1", "https://example.com");

    expect(saveLinkPreviewResult).toHaveBeenCalledWith("l1", {
      status: "ready",
      title: "Hello",
      description: "World",
      imageUrl: "https://cdn.example.com/x.png",
    });
    expect(setLinkPreviewRetry).toHaveBeenCalledWith("l1", "none");
    expect(putAsset).not.toHaveBeenCalled();
  });

  test("marks network when preview fetch throws offline", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));

    await enrichLinkPreview("l1", "https://example.com");

    expect(saveLinkPreviewResult).toHaveBeenCalledWith("l1", {
      status: "failed",
      retry: "network",
    });
  });
});
