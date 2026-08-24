import { beforeEach, describe, expect, test, vi } from "vitest";
import { putAsset } from "@/persistence/assets";
import {
  saveLinkPreviewResult,
  setLinkPreviewAssetId,
  setLinkPreviewPending,
} from "@/persistence/items";
import { enrichLinkPreview } from "./enrich-link-preview";
import { ITEMS_CHANGED_EVENT } from "./items-events";

vi.mock("@/persistence/items", () => ({
  setLinkPreviewPending: vi.fn(),
  saveLinkPreviewResult: vi.fn(),
  setLinkPreviewAssetId: vi.fn(),
}));

vi.mock("@/persistence/assets", () => ({
  putAsset: vi.fn(),
}));

describe("enrichLinkPreview", () => {
  beforeEach(() => {
    vi.mocked(setLinkPreviewPending).mockReset();
    vi.mocked(saveLinkPreviewResult).mockReset();
    vi.mocked(setLinkPreviewAssetId).mockReset();
    vi.mocked(putAsset).mockReset();
    vi.mocked(setLinkPreviewPending).mockResolvedValue({} as never);
    vi.mocked(saveLinkPreviewResult).mockResolvedValue({} as never);
    vi.mocked(setLinkPreviewAssetId).mockResolvedValue({} as never);
    vi.mocked(putAsset).mockResolvedValue({
      id: "a1",
      mimeType: "image/png",
      byteLength: 3,
      bytes: new Uint8Array([1, 2, 3]),
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
    expect(fetch).toHaveBeenCalledWith("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    expect(saveLinkPreviewResult).toHaveBeenCalledWith("l1", {
      status: "ready",
      title: "Hello",
      description: "World",
      imageUrl: "https://cdn.example.com/x.png",
    });
    expect(fetch).toHaveBeenCalledWith("/api/preview-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://cdn.example.com/x.png" }),
    });
    expect(putAsset).toHaveBeenCalled();
    expect(setLinkPreviewAssetId).toHaveBeenCalledWith("l1", "a1");
    expect(
      dispatchSpy.mock.calls.some(
        ([event]) =>
          event instanceof Event && event.type === ITEMS_CHANGED_EVENT,
      ),
    ).toBe(true);
  });

  test("marks failed when the preview API responds non-OK", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "nope" }),
    } as Response);

    await enrichLinkPreview("l1", "https://example.com");

    expect(saveLinkPreviewResult).toHaveBeenCalledWith("l1", {
      status: "failed",
    });
    expect(putAsset).not.toHaveBeenCalled();
  });

  test("skips local bytes when the image API rejects oversize", async () => {
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
    expect(putAsset).not.toHaveBeenCalled();
  });
});
