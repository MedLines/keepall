"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** Default root margin — start loading slightly before the row enters view. */
export const NEAR_VIEWPORT_ROOT_MARGIN = "240px 0px";

/**
 * True when the observed element is intersecting the viewport (with margin).
 * Falls back to true when IntersectionObserver is unavailable (tests, old browsers).
 */
export function useNearViewport(
  rootMargin: string = NEAR_VIEWPORT_ROOT_MARGIN,
  rootRef?: RefObject<HTMLElement | null>,
): { ref: RefObject<HTMLDivElement | null>; near: boolean } {
  const ref = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setNear(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setNear(entry.isIntersecting);
      },
      { rootMargin, root: rootRef?.current },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin, rootRef]);

  return { ref, near };
}
