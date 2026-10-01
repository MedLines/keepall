import { act, cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { buildLink, type LinkItem } from "@/domain/link";
import { PREVIEW_DAILY_VIEWPORT_CAP } from "@/domain/preview-enrich";
import { enrichLinkPreview } from "./enrich-link-preview";
import { clearPreviewBudgetForTests, trySpendViewportAutoBudget } from "./preview-budget-storage";
import { pausePreviewEnrichForNavigation, resetPreviewEnrichCoordinatorForTests, setViewportPreviewEnrichEnabled } from "./preview-enrich-coordinator";
import { usePreviewEnrichViewport } from "./use-preview-enrich-viewport";

vi.mock("./enrich-link-preview", () => ({ enrichLinkPreview: vi.fn().mockResolvedValue(undefined) }));

const link = buildLink({ url: "https://example.com/reference" }, { id: "old-link", now: 1 });
let visible = true;

function Card({ item = link }: { item?: LinkItem }) {
  const ref = useRef<HTMLDivElement>(null);
  usePreviewEnrichViewport(ref, item);
  return <div ref={ref}>Imported link</div>;
}

beforeEach(() => {
  resetPreviewEnrichCoordinatorForTests();
  clearPreviewBudgetForTests();
  vi.mocked(enrichLinkPreview).mockClear();
  visible = true;
  vi.stubGlobal("IntersectionObserver", class {
    constructor(private callback: IntersectionObserverCallback) {}
    observe(target: Element) {
      this.callback([{ target, isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
    disconnect() {}
  });
});

afterEach(() => {
  cleanup();
  resetPreviewEnrichCoordinatorForTests();
  vi.unstubAllGlobals();
});

test("automatically enriches a visible card mounted during the navigation pause after resume", () => {
  pausePreviewEnrichForNavigation();
  render(<Card />);
  expect(enrichLinkPreview).not.toHaveBeenCalled();
  act(() => setViewportPreviewEnrichEnabled(true));
  expect(enrichLinkPreview).toHaveBeenCalledExactlyOnceWith(link.id, link.url, expect.objectContaining({ signal: expect.any(AbortSignal) }));
});

test("rechecks viewport visibility after a pause for an already mounted card", () => {
  visible = false;
  render(<Card />);
  expect(enrichLinkPreview).not.toHaveBeenCalled();
  act(() => pausePreviewEnrichForNavigation());
  visible = true;
  act(() => setViewportPreviewEnrichEnabled(true));
  expect(enrichLinkPreview).toHaveBeenCalledOnce();
});

test("does not fetch a card removed before resume", () => {
  pausePreviewEnrichForNavigation();
  const { unmount } = render(<Card />);
  unmount();
  act(() => setViewportPreviewEnrichEnabled(true));
  expect(enrichLinkPreview).not.toHaveBeenCalled();
});

test("resuming preserves the daily automatic-fetch cap", () => {
  for (let index = 0; index < PREVIEW_DAILY_VIEWPORT_CAP; index++) trySpendViewportAutoBudget();
  pausePreviewEnrichForNavigation();
  render(<Card />);
  act(() => setViewportPreviewEnrichEnabled(true));
  expect(enrichLinkPreview).not.toHaveBeenCalled();
});

test("does not refresh an already enriched card when browsing resumes", () => {
  pausePreviewEnrichForNavigation();
  render(<Card item={{ ...link, previewStatus: "ready" }} />);
  act(() => setViewportPreviewEnrichEnabled(true));
  expect(enrichLinkPreview).not.toHaveBeenCalled();
});
