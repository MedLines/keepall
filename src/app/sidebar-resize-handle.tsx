"use client";

import { useLayoutEffect, useRef } from "react";

const WIDTH_KEY = "keepall-shell-sidebar-width";
const DEFAULT_WIDTH = 256;
const MIN_WIDTH = 224;
const MAX_WIDTH = 400;
const RAIL_WIDTH = 56;
const COLLAPSE_THRESHOLD = (MIN_WIDTH + RAIL_WIDTH) / 2;

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

  useLayoutEffect(() => {
    expandedRef.current = expanded;
    const handle = handleRef.current;
    handle?.setAttribute("aria-valuenow", String(expanded ? Math.min(widthRef.current, maximumWidth()) : RAIL_WIDTH));
    handle?.setAttribute("aria-valuetext", expanded ? `${Math.round(Math.min(widthRef.current, maximumWidth()))} pixels` : "Collapsed");
  }, [expanded]);

  useLayoutEffect(() => {
    const handle = handleRef.current!;
    const sidebar = handle.parentElement!;
    const libraryPanel = sidebar.parentElement?.querySelector<HTMLElement>("[data-library-panel]");
    let frame = 0;
    let drag: { pointerId: number; startX: number; startWidth: number; savedWidth: number; wasExpanded: boolean; nextWidth: number } | null = null;

    try {
      const stored = Number(localStorage.getItem(WIDTH_KEY));
      if (Number.isFinite(stored) && stored >= MIN_WIDTH && stored <= MAX_WIDTH) widthRef.current = stored;
    } catch {
      // Resizing still works when the browser disallows preference storage.
    }
    sidebar.style.setProperty("--sidebar-width", `${widthRef.current}px`);

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
      if (open !== expandedRef.current) {
        expandedRef.current = open;
        onExpandedChange(open);
      }
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
        updateAria();
      } else {
        apply(current.nextWidth);
        save();
      }
      delete sidebar.dataset.resizing;
      delete document.documentElement.dataset.sidebarResizing;
      libraryPanel?.style.removeProperty("--library-resize-width");
      if (handle.hasPointerCapture(current.pointerId)) handle.releasePointerCapture(current.pointerId);
    }

    function pointerDown(event: PointerEvent) {
      if (event.button !== 0 || !event.isPrimary || drag) return;
      event.preventDefault();
      const startWidth = sidebar.getBoundingClientRect().width;
      // Keep card widths and the virtualizer's viewport steady until release.
      if (libraryPanel) {
        libraryPanel.style.setProperty("--library-resize-width", `${libraryPanel.getBoundingClientRect().width}px`);
      }
      drag = { pointerId: event.pointerId, startX: event.clientX, startWidth, savedWidth: widthRef.current, wasExpanded: expandedRef.current, nextWidth: startWidth };
      handle.focus({ preventScroll: true });
      handle.setPointerCapture(event.pointerId);
      sidebar.dataset.resizing = "";
      document.documentElement.dataset.sidebarResizing = "";
    }

    function pointerMove(event: PointerEvent) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag.nextWidth = drag.startWidth + event.clientX - drag.startX;
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        if (drag) apply(drag.nextWidth);
      });
    }

    function pointerUp(event: PointerEvent) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag.nextWidth = drag.startWidth + event.clientX - drag.startX;
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

    function resize() { cancel(); updateAria(); }

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
  }, [onExpandedChange]);

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
      title="Drag to resize. Arrow keys to resize; Enter to collapse or expand."
      className="library-sidebar-resize"
    />
  );
}
