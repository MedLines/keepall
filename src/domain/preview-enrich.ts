import type { LinkItem } from "./link";

/** Max idle links to auto-enrich once after an import. */
export const PREVIEW_ENRICH_WELCOME_BATCH_SIZE = 100;

/** Parallel `/api/preview` calls from the library coordinator. */
export const PREVIEW_ENRICH_CONCURRENCY = 2;

/** Prefetch margin for viewport-triggered enrich. */
export const PREVIEW_ENRICH_VIEWPORT_ROOT_MARGIN = "240px";

/** True when a link has never been enriched (first pass, not a Slice 27 retry). */
export function linkNeedsPreviewEnrich(link: LinkItem): boolean {
  return link.previewStatus === "idle";
}
