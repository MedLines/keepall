"use client";

import { animate, useMotionValue, useReducedMotion } from "motion/react";
import { uiMotion } from "@/components/ui/motion-tokens";
import { useLayoutEffect, useRef } from "react";
import {
  SIDEBAR_WIDTH_KEY as WIDTH_KEY,
  SIDEBAR_DEFAULT_WIDTH as DEFAULT_WIDTH,
  SIDEBAR_MIN_WIDTH as MIN_WIDTH,
  SIDEBAR_MAX_WIDTH as MAX_WIDTH,
} from "./shell-styles";
const RAIL_WIDTH = 56;
const COLLAPSE_THRESHOLD = MIN_WIDTH - 56;
const DRAG_SLOP = 4;

function maximumWidth() {
  return Math.min(MAX_WIDTH, window.innerWidth * 0.4);
}

export function SidebarResizeHandle({ expanded, onExpandedChange }: {
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
}) {
  const handleRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(DEFAULT_WIDTH);
  const expandedRef = useRef(expanded);
  const displayedWidth = useMotionValue(DEFAULT_WIDTH);
  const reduceMotion = useReducedMotion();
  const syncWidth = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    expandedRef.current = expanded;
    syncWidth.current?.();
    const handle = handleRef.current;
    handle?.setAttribute("aria-valuenow", String(expanded ? Math.min(widthRef.current, maximumWidth()) : RAIL_WIDTH));
    handle?.setAttribute("aria-valuetext", expanded ? `${Math.round(Math.min(widthRef.current, maximumWidth()))} pixels` : "Collapsed");
  }, [expanded]);

  useLayoutEffect(() => {
    const handle = handleRef.current!;
    const sidebar = handle.parentElement!;
    const libraryPanel = sidebar.parentElement?.querySelector<HTMLElement>("[data-library-panel]");
    let frame = 0;
    let animation: ReturnType<typeof animate> | null = null;
    let targetWidth = DEFAULT_WIDTH;
    let drag: { pointerId: number; startX: number; startWidth: number; savedWidth: number; wasExpanded: boolean; moved: boolean; nextWidth: number } | null = null;

    try {
      const stored = Number(localStorage.getItem(WIDTH_KEY));
      if (Number.isFinite(stored) && stored >= MIN_WIDTH && stored <= MAX_WIDTH) widthRef.current = stored;
    } catch {
      // Resizing still works when the browser disallows preference storage.
    }
    sidebar.style.setProperty("--sidebar-width", `${widthRef.current}px`);

    function freezeLibrary() {
      if (libraryPanel && !libraryPanel.style.getPropertyValue("--library-resize-width")) {
        libraryPanel.style.setProperty("--library-resize-width", `${libraryPanel.getBoundingClientRect().width}px`);
      }
    }

    function releaseLibrary() {
      if (!drag && !animation) libraryPanel?.style.removeProperty("--library-resize-width");
    }

    function stopAnimation() {
      const previous = animation;
      animation = null;
      previous?.stop();
    }

    const unsubscribeWidth = displayedWidth.on("change", value => {
      sidebar.style.width = `${Math.max(RAIL_WIDTH, Math.min(maximumWidth(), value))}px`;
    });
    const initialOpen = sidebar.dataset.ready === "false" && document.documentElement.dataset.shellPanel === "closed" ? false : expandedRef.current;
    const initialWidth = initialOpen ? Math.min(widthRef.current, maximumWidth()) : RAIL_WIDTH;
    displayedWidth.set(initialWidth);
    sidebar.style.width = `${initialWidth}px`;
    targetWidth = initialWidth;

    function updateWidth(tier: typeof uiMotion.slow | typeof uiMotion.moderate = uiMotion.slow, immediate = false) {
      const next = expandedRef.current ? Math.min(widthRef.current, maximumWidth()) : RAIL_WIDTH;
      if (targetWidth === next && (animation || displayedWidth.get() === next)) return;
      targetWidth = next;
      stopAnimation();
      if (immediate || reduceMotion) {
        displayedWidth.set(next);
        releaseLibrary();
        return;
      }
      freezeLibrary();
      const playback = animate(displayedWidth, next, expandedRef.current ? tier : tier.exit);
      animation = playback;
      playback.then(() => {
        if (animation !== playback) return;
        animation = null;
        releaseLibrary();
      });
    }
    syncWidth.current = () => updateWidth(drag ? uiMotion.moderate : uiMotion.slow);

    function updateAria() {
      const width = expandedRef.current ? Math.min(widthRef.current, maximumWidth()) : RAIL_WIDTH;
      handle.setAttribute("aria-valuenow", String(Math.round(width)));
      handle.setAttribute("aria-valuemax", String(Math.floor(maximumWidth())));
      handle.setAttribute("aria-valuetext", expandedRef.current ? `${Math.round(width)} pixels` : "Collapsed");
    }

    function apply(requested: number) {
      const open = requested > COLLAPSE_THRESHOLD;
      if (open) {
        widthRef.current = Math.max(MIN_WIDTH, Math.min(maximumWidth(), Math.round(requested)));
        sidebar.style.setProperty("--sidebar-width", `${widthRef.current}px`);
      }
      const flipped = open !== expandedRef.current;
      expandedRef.current = open;
      updateWidth(drag ? uiMotion.moderate : uiMotion.slow, Boolean(drag) && !flipped && !animation);
      if (flipped) onExpandedChange(open);
      updateAria();
    }

    function save() {
      try {
        localStorage.setItem(WIDTH_KEY, String(widthRef.current));
      } catch {
        // Keep the current width for this session if storage is unavailable.
      }
    }

    function finish(cancel = false) {
      if (!drag) return;
      cancelAnimationFrame(frame);
      frame = 0;
      const current = drag;
      drag = null;
      if (cancel) {
        widthRef.current = current.savedWidth;
        sidebar.style.setProperty("--sidebar-width", `${current.savedWidth}px`);
        expandedRef.current = current.wasExpanded;
        onExpandedChange(current.wasExpanded);
        updateWidth();
        updateAria();
      } else {
        apply(current.moved ? current.nextWidth : expandedRef.current ? RAIL_WIDTH : widthRef.current);
        save();
      }
      delete sidebar.dataset.resizing;
      delete document.documentElement.dataset.sidebarResizing;
      releaseLibrary();
      if (handle.hasPointerCapture(current.pointerId)) handle.releasePointerCapture(current.pointerId);
    }

    function pointerDown(event: PointerEvent) {
      if (event.button !== 0 || !event.isPrimary || drag) return;
      event.preventDefault();
      stopAnimation();
      const startWidth = displayedWidth.get();
      // Hold card widths through dragging and the final collapse transition.
      freezeLibrary();
      drag = { pointerId: event.pointerId, startX: event.clientX, startWidth, savedWidth: widthRef.current, wasExpanded: expandedRef.current, moved: false, nextWidth: startWidth };
      handle.focus({ preventScroll: true });
      handle.setPointerCapture(event.pointerId);
      sidebar.dataset.resizing = "";
      document.documentElement.dataset.sidebarResizing = "";
    }

    function pointerMove(event: PointerEvent) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const delta = event.clientX - drag.startX;
      if (!drag.moved && Math.abs(delta) < DRAG_SLOP) return;
      drag.moved = true;
      drag.nextWidth = drag.startWidth + delta;
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        if (drag) apply(drag.nextWidth);
      });
    }

    function pointerUp(event: PointerEvent) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const delta = event.clientX - drag.startX;
      drag.moved ||= Math.abs(delta) >= DRAG_SLOP;
      drag.nextWidth = drag.startWidth + delta;
      finish();
    }

    function cancel() { finish(true); }

    function keyDown(event: KeyboardEvent) {
      if (drag) return;
      const width = Math.min(widthRef.current, maximumWidth());
      let next: number;
      switch (event.key) {
        case "ArrowLeft": next = expandedRef.current && width > MIN_WIDTH ? Math.max(MIN_WIDTH, width - 16) : RAIL_WIDTH; break;
        case "ArrowRight": next = expandedRef.current ? width + 16 : width; break;
        case "Home": next = RAIL_WIDTH; break;
        case "End": next = maximumWidth(); break;
        case "Enter": next = expandedRef.current ? RAIL_WIDTH : width; break;
        default: return;
      }
      event.preventDefault();
      apply(next);
      save();
    }

    function escape(event: KeyboardEvent) {
      if (drag && event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }
    }

    function resize() { cancel(); stopAnimation(); updateWidth(uiMotion.slow, true); releaseLibrary(); updateAria(); }

    updateAria();
    handle.addEventListener("pointerdown", pointerDown);
    handle.addEventListener("pointermove", pointerMove);
    handle.addEventListener("pointerup", pointerUp);
    handle.addEventListener("pointercancel", cancel);
    handle.addEventListener("lostpointercapture", cancel);
    handle.addEventListener("keydown", keyDown);
    window.addEventListener("keydown", escape, true);
    window.addEventListener("blur", cancel);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      stopAnimation();
      unsubscribeWidth();
      syncWidth.current = null;
      delete sidebar.dataset.resizing;
      delete document.documentElement.dataset.sidebarResizing;
      libraryPanel?.style.removeProperty("--library-resize-width");
      handle.removeEventListener("pointerdown", pointerDown);
      handle.removeEventListener("pointermove", pointerMove);
      handle.removeEventListener("pointerup", pointerUp);
      handle.removeEventListener("pointercancel", cancel);
      handle.removeEventListener("lostpointercapture", cancel);
      handle.removeEventListener("keydown", keyDown);
      window.removeEventListener("keydown", escape, true);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("resize", resize);
    };
  }, [onExpandedChange, displayedWidth, reduceMotion]);

  return (
    <div
      ref={handleRef}
      role="separator"
      tabIndex={0}
      aria-label="Resize sidebar"
      aria-controls="library-sidebar"
      aria-orientation="vertical"
      aria-valuemin={RAIL_WIDTH}
      aria-valuemax={MAX_WIDTH}
      aria-valuenow={expanded ? DEFAULT_WIDTH : RAIL_WIDTH}
      title="Drag to resize. Click or press Enter to collapse or expand. Arrow keys resize."
      className="library-sidebar-resize"
    />
  );
}
