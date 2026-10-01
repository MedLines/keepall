"use client";

import { type RefObject, useEffect } from "react";
import { PREVIEW_ENRICH_VIEWPORT_ROOT_MARGIN } from "@/domain/preview-enrich";
import type { LinkItem } from "@/domain/link";
import { isPreviewEnrichPaused, subscribePreviewEnrichPause } from "./preview-enrich-pause";
import { requestPreviewEnrichViewport } from "./preview-enrich-coordinator";

/** When a link card enters the viewport, ask the coordinator to enrich it. */
export function usePreviewEnrichViewport(
  elementRef: RefObject<Element | null>,
  link: LinkItem | null,
): void {
  const linkId = link?.id;
  const url = link?.url;
  const status = link?.previewStatus;

  useEffect(() => {
    if (!linkId || !url || status !== "idle") {
      return;
    }

    const element = elementRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      return;
    }

    let observer: IntersectionObserver | null = null;
    const observeWhenResumed = () => {
      observer?.disconnect();
      observer = null;
      if (isPreviewEnrichPaused()) return;
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              requestPreviewEnrichViewport(linkId, url);
            }
          }
        },
        { rootMargin: PREVIEW_ENRICH_VIEWPORT_ROOT_MARGIN, threshold: 0 },
      );
      observer.observe(element);
    };

    const unsubscribe = subscribePreviewEnrichPause(observeWhenResumed);
    observeWhenResumed();
    return () => {
      unsubscribe();
      observer?.disconnect();
    };
  }, [elementRef, linkId, url, status]);
}
