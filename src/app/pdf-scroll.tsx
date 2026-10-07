"use client";

import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { PdfPage } from "./pdf-page";
import type { PdfPageSize } from "./use-pdf-page-sizes";

export type PdfScrollHandle = { goToPage: (number: number) => void };

export function PdfScroll({ document, sizes, zoom, view, startPage, onPageChange, ref }: {
  sizes: PdfPageSize[];
  document: PDFDocumentProxy; zoom: string; view: "scroll" | "pages"; startPage: number;
  onPageChange: (number: number) => void; ref: Ref<PdfScrollHandle>;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const measuredWidth = useRef(0);
  const pendingPage = useRef<number | null>(startPage);
  const previousView = useRef(view);
  const [renderedPage, setRenderedPage] = useState(startPage);
  const [pageKeys, setPageKeys] = useState(() => sizes.map((_, index) => index));
  if (renderedPage !== startPage) {
    if (view === "pages") {
      // Reuse the single-page renderer, then carry its identity back to Scroll.
      const keys = [...pageKeys];
      [keys[renderedPage - 1], keys[startPage - 1]] = [keys[startPage - 1], keys[renderedPage - 1]];
      setPageKeys(keys);
    }
    setRenderedPage(startPage);
  }
  const getItemKey = useCallback((index: number) => pageKeys[index], [pageKeys]);
  const [geometry, setGeometry] = useState({ width: 0, offset: 0, contentInset: 0, scrollbarSize: 0 });
  function viewportSize(index: number) {
    const size = sizes[index];
    const scale = zoom === "fit" ? Math.max(1, geometry.width - 2) / size.width : Number(zoom);
    return { width: size.width * scale, height: size.height * scale };
  }
  const virtualizer = useVirtualizer<HTMLElement, HTMLDivElement>({
    count: document.numPages,
    getItemKey,
    getScrollElement: () => frame.current?.closest<HTMLElement>("[data-document-scroll]") ?? null,
    estimateSize: index => {
      const size = viewportSize(index);
      return size.height + 2 + (size.width > geometry.width - 2 ? geometry.scrollbarSize : 0);
    },
    scrollMargin: geometry.offset,
    scrollPaddingStart: geometry.contentInset,
    gap: 24,
    overscan: 1,
    enabled: view === "scroll" && geometry.width > 0,
    rangeExtractor: range => {
      const indexes = defaultRangeExtractor(range);
      // Keep the selected canvas mounted while the scroll position is restored.
      return indexes.includes(startPage - 1) ? indexes : [...indexes, startPage - 1].sort((a, b) => a - b);
    },
    directDomUpdates: true,
    useFlushSync: false,
    useAnimationFrameWithResizeObserver: true,
    onChange: instance => {
      if (view !== "scroll" || previousView.current !== view || !measuredWidth.current) return;
      const offset = (instance.scrollOffset ?? 0) + geometry.contentInset;
      const visible = instance.getVirtualItems().find(row => row.end > offset);
      if (pendingPage.current !== null) {
        if (!visible || visible.index + 1 !== pendingPage.current) return;
        pendingPage.current = null;
      }
      if (visible) onPageChange(visible.index + 1);
    },
  });

  useLayoutEffect(() => {
    const node = frame.current;
    const scroll = node?.closest<HTMLElement>("[data-document-scroll]");
    if (!node || !scroll) return;
    const toolbar = scroll.querySelector<HTMLElement>("[data-pdf-toolbar]");
    const measure = () => {
      const next = {
        width: Math.floor(node.getBoundingClientRect().width),
        offset: node.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop,
        contentInset: toolbar ? toolbar.getBoundingClientRect().height + (Number.parseFloat(getComputedStyle(toolbar).top) || 0) + (Number.parseFloat(getComputedStyle(node.parentElement!).rowGap) || 0) : 0,
        scrollbarSize: scroll.offsetWidth - scroll.clientWidth,
      };
      setGeometry(previous => previous.width === next.width && previous.offset === next.offset && previous.contentInset === next.contentInset && previous.scrollbarSize === next.scrollbarSize ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observer.observe(scroll);
    if (toolbar) observer.observe(toolbar);
    return () => observer.disconnect();
  }, [view]);

  useLayoutEffect(() => {
    if (!geometry.width) return;
    if (view === "pages") {
      previousView.current = view;
      const node = frame.current;
      const scroll = node?.closest<HTMLElement>("[data-document-scroll]");
      if (node && scroll) scroll.scrollTo({ top: node.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop - geometry.contentInset, behavior: "instant" });
      return;
    }
    const switched = previousView.current !== view;
    previousView.current = view;
    if (!switched && measuredWidth.current === geometry.width) return;
    const resized = measuredWidth.current > 0;
    measuredWidth.current = geometry.width;
    pendingPage.current = startPage;
    // Previously measured heights belong to the old width, including offscreen pages.
    virtualizer.measure();
    if (resized || switched || startPage > 1) virtualizer.scrollToIndex(startPage - 1, { align: "start" });
  }, [virtualizer, geometry.width, geometry.contentInset, startPage, view]);

  useImperativeHandle(ref, () => ({ goToPage: number => {
    if (view !== "scroll") return;
    pendingPage.current = number;
    virtualizer.scrollToIndex(number - 1, { align: "start" });
  } }), [virtualizer, view]);

  const rows = virtualizer.getVirtualItems();
  const selected = { key: pageKeys[startPage - 1], index: startPage - 1 };
  const pages = view === "pages" ? [selected] : rows.some(row => row.index === selected.index) ? rows : [...rows, selected].sort((a, b) => a.index - b.index);
  // Pages overrides transforms without erasing the virtualizer's cached inline positions.
  return <div ref={frame} aria-label={view === "scroll" ? "Continuous PDF pages" : undefined} className="min-w-0">
    <div ref={view === "scroll" ? virtualizer.containerRef : undefined} className="relative w-full" style={{ height: view === "pages" ? "auto" : undefined }}>
      {pages.map(row => <div key={row.key} data-index={row.index} ref={view === "scroll" ? virtualizer.measureElement : undefined} className={view === "scroll" ? "absolute left-0 top-0 w-full" : "relative w-full transform-none!"}>
        <PdfPage document={document} number={row.index + 1} zoom={zoom} viewportSize={viewportSize(row.index)} />
      </div>)}
    </div>
  </div>;
}
