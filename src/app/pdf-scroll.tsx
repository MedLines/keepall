"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { PdfPage } from "./pdf-page";
import type { PdfPageSize } from "./use-pdf-page-sizes";

export type PdfScrollHandle = { goToPage: (number: number) => void };

export function PdfScroll({ document, sizes, zoom, startPage, onPageChange, ref }: {
  sizes: PdfPageSize[];
  document: PDFDocumentProxy; zoom: string; startPage: number;
  onPageChange: (number: number) => void; ref: Ref<PdfScrollHandle>;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const measuredWidth = useRef(0);
  const [geometry, setGeometry] = useState({ width: 0, offset: 0, contentInset: 0, scrollbarSize: 0 });
  function viewportSize(index: number) {
    const size = sizes[index];
    const scale = zoom === "fit" ? Math.max(1, geometry.width - 2) / size.width : Number(zoom);
    return { width: size.width * scale, height: size.height * scale };
  }
  const virtualizer = useVirtualizer<HTMLElement, HTMLDivElement>({
    count: document.numPages,
    getScrollElement: () => frame.current?.closest<HTMLElement>("[data-document-scroll]") ?? null,
    estimateSize: index => {
      const size = viewportSize(index);
      return size.height + 2 + (size.width > geometry.width - 2 ? geometry.scrollbarSize : 0);
    },
    scrollMargin: geometry.offset,
    scrollPaddingStart: geometry.contentInset,
    gap: 24,
    overscan: 1,
    enabled: geometry.width > 0,
    directDomUpdates: true,
    useFlushSync: false,
    useAnimationFrameWithResizeObserver: true,
    onChange: instance => {
      const offset = (instance.scrollOffset ?? 0) + geometry.contentInset;
      const visible = instance.getVirtualItems().find(row => row.end > offset);
      if (visible) onPageChange(visible.index + 1);
    },
  });

  useEffect(() => {
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
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observer.observe(scroll);
    if (toolbar) observer.observe(toolbar);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!geometry.width || measuredWidth.current === geometry.width) return;
    const resized = measuredWidth.current > 0;
    measuredWidth.current = geometry.width;
    // Previously measured heights belong to the old width, including offscreen pages.
    virtualizer.measure();
    if (resized || startPage > 1) virtualizer.scrollToIndex(startPage - 1, { align: "start" });
  }, [virtualizer, geometry.width, startPage]);

  useImperativeHandle(ref, () => ({ goToPage: number => virtualizer.scrollToIndex(number - 1, { align: "start" }) }), [virtualizer]);

  return <div ref={frame} aria-label="Continuous PDF pages" className="min-w-0">
    <div ref={virtualizer.containerRef} className="relative w-full">
      {virtualizer.getVirtualItems().map(row => <div key={row.key} data-index={row.index} ref={virtualizer.measureElement} className="absolute left-0 top-0 w-full">
        <PdfPage document={document} number={row.index + 1} zoom={zoom} viewportSize={viewportSize(row.index)} />
      </div>)}
    </div>
  </div>;
}
