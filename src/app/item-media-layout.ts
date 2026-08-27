import { useEffect, useRef, useState } from "react";
import type { LibraryLayout } from "@/domain/library-view";
import { itemMediaLayoutId } from "@/domain/library-view";

/** Cover FLIP spring (seconds). */
export const BROWSE_LAYOUT_TRANSITION = {
  type: "spring" as const,
  duration: 0.35,
  bounce: 0,
};

/**
 * How long text/tags stay hidden before fading back (ms).
 * Lower = text returns sooner. Try ~180–220 if 350 feels late.
 * Independent of the cover spring above.
 */
export const BROWSE_CHROME_REVEAL_MS = 150;

/**
 * Fade-in / fade-out length for chrome once reveal flips (seconds).
 * Used in library-item.tsx `chromeMotion.transition.duration`.
 */
export const BROWSE_CHROME_FADE_S = {
  in: 0.15,
  out: 0.05,
};

/**
 * Cover only — `layoutId` like playlist `cover-${id}`.
 * No shell/title layout: those scale and stretch the image mid-flight.
 */
export function itemMediaLayoutProps(
  itemId: string,
  layoutMode: LibraryLayout,
  reduceMotion: boolean | null,
): {
  layout?: boolean;
  layoutId?: string;
  layoutDependency?: LibraryLayout;
  transition?: typeof BROWSE_LAYOUT_TRANSITION;
} {
  if (reduceMotion) {
    return {};
  }

  return {
    layout: true,
    layoutId: itemMediaLayoutId(itemId),
    layoutDependency: layoutMode,
    transition: BROWSE_LAYOUT_TRANSITION,
  };
}

/**
 * Hide text/tags/chrome while the cover morphs, then fade them back
 * (DetailView pattern: shared cover moves; the rest is opacity, not layout).
 */
export function useBrowseChromeVisible(
  layoutMode: LibraryLayout,
  reduceMotion: boolean | null,
): boolean {
  const [visible, setVisible] = useState(true);
  const prevMode = useRef(layoutMode);

  useEffect(() => {
    if (reduceMotion) {
      prevMode.current = layoutMode;
      setVisible(true);
      return;
    }
    if (prevMode.current === layoutMode) {
      return;
    }
    prevMode.current = layoutMode;
    setVisible(false);
    const id = window.setTimeout(() => setVisible(true), BROWSE_CHROME_REVEAL_MS);
    return () => window.clearTimeout(id);
  }, [layoutMode, reduceMotion]);

  return visible;
}
