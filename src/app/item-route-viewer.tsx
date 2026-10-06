"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

/** Subscribe before Next's history listener so it cannot commit the return eagerly. */
export function ItemNavigationHistory() {
  const router = useRouter();
  useLayoutEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onPopState = (event: PopStateEvent) => {
      if (timer !== null) clearTimeout(timer);
      if (window.location.pathname !== "/" || !document.querySelector("[data-item-route-viewer]")) return;
      event.stopImmediatePropagation();
      const href = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      // Leave popstate's eager React commit, preserving the selected history entry.
      timer = setTimeout(() => router.replace(href, { scroll: false }), 0);
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (timer !== null) clearTimeout(timer);
    };
  }, [router]);
  return null;
}

/** Render in the route commit so shared images exist when React captures the new view. */
export function ItemRouteViewer({ children }: { children: ReactNode }) {
  const router = useRouter();
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const background = document.getElementById("route-content");
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const wasInert = background?.inert ?? false;
    const previousOverflow = document.body.style.overflow;
    if (background) background.inert = true;
    document.body.style.overflow = "hidden";
    viewerRef.current?.focus({ preventScroll: true });
    return () => {
      if (background) background.inert = wasInert;
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [router]);

  return <div ref={viewerRef} data-item-route-viewer role="dialog" aria-modal="true" aria-label="Full item view" tabIndex={-1}
    className="fixed inset-0 z-[60] overflow-hidden bg-bg-canvas outline-none"
    onKeyDown={event => {
      if ((event.target as HTMLElement).closest('[role="dialog"]') !== event.currentTarget) return;
      if (event.defaultPrevented) return;
      if (event.key === "Escape") { event.preventDefault(); router.back(); return; }
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button, input, textarea, select, [tabindex]'))
        .filter(node => node.tabIndex >= 0 && !node.matches(":disabled") && node.getClientRects().length > 0 && !node.closest("[inert]"));
      const first = controls[0];
      const last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) {
        event.preventDefault(); first.focus();
      }
    }}>
    {children}
  </div>;
}
