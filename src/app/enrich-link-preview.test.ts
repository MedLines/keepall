import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  saveLinkPreviewResult,
  setLinkPreviewPending,
} from "@/persistence/items";
import { enrichLinkPreview } from "./enrich-link-preview";
import { ITEMS_CHANGED_EVENT } from "./items-events";

vi.mock("@/persistence/items", () => ({
  setLinkPreviewPending: vi.fn(),
  saveLinkPreviewResult: vi.fn(),
}));

describe("enrichLinkPreview", () => {
  beforeEach(() => {
    vi.mocked(setLinkPreviewPending).mockReset();
    vi.mocked(saveLinkPreviewResult).mockReset();
    vi.mocked(setLinkPreviewPending).mockResolvedValue({} as never);
    vi.mocked(saveLinkPreviewResult).mockResolvedValue({} as never);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          title: "Hello",
          description: "World",
          imageUrl: "https://cdn.example.com/x.png",
        }),
      }),
    );
  });

  test("marks pending, then stores a ready preview from /api/preview", async () => {
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
    expect(
      dispatchSpy.mock.calls.some(
        ([event]) =>
          event instanceof Event && event.type === ITEMS_CHANGED_EVENT,
      ),
    ).toBe(true);
  });

  test("marks failed when the API responds non-OK", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "nope" }),
    } as Response);

    await enrichLinkPreview("l1", "https://example.com");

    expect(saveLinkPreviewResult).toHaveBeenCalledWith("l1", {
      status: "failed",
    });
  });
});
