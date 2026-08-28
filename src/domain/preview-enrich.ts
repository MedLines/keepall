import type { LinkItem } from "./link";

/** Max idle links to auto-enrich once after an import. */
export const PREVIEW_ENRICH_WELCOME_BATCH_SIZE = 100;

/** Max viewport auto-enrich calls per local calendar day. Welcome batch is separate. */
export const PREVIEW_DAILY_VIEWPORT_CAP = 100;

/** Parallel `/api/preview` calls from the library coordinator. */
export const PREVIEW_ENRICH_CONCURRENCY = 2;

/** Prefetch margin for viewport-triggered enrich. */
export const PREVIEW_ENRICH_VIEWPORT_ROOT_MARGIN = "240px";

/** True when a link has never been enriched (first pass, not a Slice 27 retry). */
export function linkNeedsPreviewEnrich(link: LinkItem): boolean {
  return link.previewStatus === "idle";
}

/** Local calendar day key for daily preview budget (YYYY-MM-DD). */
export function previewBudgetDayKey(now = Date.now()): string {
  const date = new Date(now);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** True when inspect may offer a user-initiated preview fetch. */
export function linkCanManualPreviewFetch(link: LinkItem): boolean {
  if (linkNeedsPreviewEnrich(link)) {
    return true;
  }
  return link.previewStatus === "failed" && link.previewRetry === "network";
}
