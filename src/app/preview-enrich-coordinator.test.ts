import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildLink } from "@/domain/link";
import { listItems } from "@/persistence/items";
import { enrichLinkPreview } from "./enrich-link-preview";
import {
  requestPreviewEnrichViewport,
  resetPreviewEnrichCoordinatorForTests,
  resumePreviewWelcomeBatch,
  startPreviewWelcomeBatch,
  subscribePreviewEnrichProgress,
} from "./preview-enrich-coordinator";
import { writeStoredWelcomeBatch } from "./preview-welcome-storage";
import {
  clearPreviewBudgetForTests,
  trySpendViewportAutoBudget,
} from "./preview-budget-storage";
import { PREVIEW_DAILY_VIEWPORT_CAP } from "@/domain/preview-enrich";

vi.mock("./enrich-link-preview", () => ({
  enrichLinkPreview: vi.fn(),
}));

vi.mock("@/persistence/items", () => ({
  listItems: vi.fn(),
}));

describe("preview-enrich-coordinator", () => {
  beforeEach(() => {
    resetPreviewEnrichCoordinatorForTests();
    clearPreviewBudgetForTests();
    vi.mocked(enrichLinkPreview).mockReset();
    vi.mocked(listItems).mockReset();
    vi.mocked(enrichLinkPreview).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 10)),
    );
  });

  test("welcome batch enqueues only idle links up to 100", async () => {
    const links = Array.from({ length: 105 }, (_, index) =>
      buildLink({ url: `https://example-${index}.com` }, { id: `l${index}`, now: 1 }),
    );
    vi.mocked(listItems).mockResolvedValue(links);

    await startPreviewWelcomeBatch(links.map((link) => link.id));

    expect(enrichLinkPreview).toHaveBeenCalledTimes(2);
    expect(enrichLinkPreview).toHaveBeenCalledWith("l0", "https://example-0.com");
    expect(enrichLinkPreview).toHaveBeenCalledWith("l1", "https://example-1.com");
  });

  test("viewport request dedupes the same link", () => {
    requestPreviewEnrichViewport("a", "https://a.example");
    requestPreviewEnrichViewport("a", "https://a.example");

    expect(enrichLinkPreview).toHaveBeenCalledTimes(1);
  });

  test("reports welcome progress until the batch finishes", async () => {
    const links = [
      buildLink({ url: "https://a.example" }, { id: "a", now: 1 }),
      buildLink({ url: "https://b.example" }, { id: "b", now: 1 }),
    ];
    vi.mocked(listItems).mockResolvedValue(links);
    vi.mocked(enrichLinkPreview).mockResolvedValue();

    const seen: Array<{ total: number; done: number } | null> = [];
    subscribePreviewEnrichProgress((progress) => {
      seen.push(
        progress?.kind === "welcome"
          ? { total: progress.total, done: progress.done }
          : null,
      );
    });

    await startPreviewWelcomeBatch(["a", "b"]);

    await vi.waitFor(() => {
      expect(seen.some((entry) => entry?.done === 2)).toBe(true);
    });
  });

  test("resumes a stored welcome batch on next open", async () => {
    const links = [
      buildLink({ url: "https://a.example" }, { id: "a", now: 1 }),
      buildLink({ url: "https://b.example" }, { id: "b", now: 1 }),
      buildLink({ url: "https://c.example" }, { id: "c", now: 1 }),
    ];
    vi.mocked(listItems).mockResolvedValue(links);
    writeStoredWelcomeBatch({
      total: 3,
      done: 1,
      remainingLinkIds: ["b", "c"],
    });

    await resumePreviewWelcomeBatch();

    expect(enrichLinkPreview).toHaveBeenCalledTimes(2);
    expect(enrichLinkPreview).toHaveBeenCalledWith("b", "https://b.example");
    expect(enrichLinkPreview).toHaveBeenCalledWith("c", "https://c.example");
  });

  test("blocks viewport enrich when the daily cap is spent", () => {
    for (let index = 0; index < PREVIEW_DAILY_VIEWPORT_CAP; index += 1) {
      trySpendViewportAutoBudget();
    }

    requestPreviewEnrichViewport("x", "https://x.example");

    expect(enrichLinkPreview).not.toHaveBeenCalled();
  });
});
