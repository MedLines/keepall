"use client";

import { type RefObject, useEffect } from "react";
import { PREVIEW_ENRICH_VIEWPORT_ROOT_MARGIN } from "@/domain/preview-enrich";
import type { LinkItem } from "@/domain/link";
import { isPreviewEnrichPaused } from "./preview-enrich-pause";
import { requestPreviewEnrichViewport } from "./preview-enrich-coordinator";

/** When a link card enters the viewport, ask the coordinator to enrich it. */
export function usePreviewEnrichViewport(
  elementRef: RefObject<Element | null>,
  link: LinkItem | null,
): void {
  useEffect(() => {
    if (!link || link.previewStatus !== "idle" || isPreviewEnrichPaused()) {
      return;
    }

    const element = elementRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            requestPreviewEnrichViewport(link.id, link.url);
          }
        }
      },
      { rootMargin: PREVIEW_ENRICH_VIEWPORT_ROOT_MARGIN, threshold: 0 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [elementRef, link?.id, link?.url, link?.previewStatus]);
}
