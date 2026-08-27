import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildLink, LINK_PREVIEW_PENDING_LEASE_MS } from "@/domain/link";
import { listItems } from "@/persistence/items";
import { enrichLinkPreview } from "./enrich-link-preview";
import { wakeLinkPreviewRetries } from "./wake-link-preview-retries";

vi.mock("@/persistence/items", () => ({
  listItems: vi.fn(),
}));

vi.mock("./enrich-link-preview", () => ({
  enrichLinkPreview: vi.fn(),
}));

describe("wakeLinkPreviewRetries", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
    vi.mocked(enrichLinkPreview).mockReset();
    vi.mocked(enrichLinkPreview).mockResolvedValue();
  });

  test("enriches links marked network and skips none", async () => {
    const network = {
      ...buildLink({ url: "https://a.example" }, { id: "a", now: 1 }),
      previewRetry: "network" as const,
    };
    const never = {
      ...buildLink({ url: "https://b.example" }, { id: "b", now: 1 }),
      previewStatus: "ready" as const,
      previewRetry: "none" as const,
    };
    vi.mocked(listItems).mockResolvedValue([network, never]);

    await wakeLinkPreviewRetries();

    expect(enrichLinkPreview).toHaveBeenCalledTimes(1);
    expect(enrichLinkPreview).toHaveBeenCalledWith("a", "https://a.example");
  });

  test("enriches dead pending leases", async () => {
    const pending = {
      ...buildLink({ url: "https://c.example" }, { id: "c", now: 1 }),
      previewStatus: "pending" as const,
      previewAttemptedAt: Date.now() - LINK_PREVIEW_PENDING_LEASE_MS - 1,
    };
    vi.mocked(listItems).mockResolvedValue([pending]);

    await wakeLinkPreviewRetries();

    expect(enrichLinkPreview).toHaveBeenCalledWith("c", "https://c.example");
  });
});
