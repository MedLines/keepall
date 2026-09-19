"use client";

import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import type { Item } from "@/domain/item";
import {
  gridColumnCount,
  LIBRARY_GRID_GAP_PX,
  LIBRARY_GRID_ROW_ESTIMATE_PX,
  LIBRARY_VIRTUALIZE_MIN,
  estimateLibraryGridItemHeight,
} from "./library-scale";

export type MasonryPlacement = {
  index: number;
  style: CSSProperties;
  measureElement: (element: HTMLLIElement | null) => void;
};

type Props = {
  items: Item[];
  scrollRef: RefObject<HTMLElement | null>;
  scopeKey: string;
  renderItem: (item: Item, placement?: MasonryPlacement) => ReactNode;
};

export function LibraryMasonry({ items, scrollRef, scopeKey, renderItem }: Props) {
  const gridRef = useRef<HTMLUListElement>(null);
  const [width, setWidth] = useState(0);
  const [scrollMargin, setScrollMargin] = useState(0);
  const columns = gridColumnCount(width);
  const columnWidth = width
    ? (width - (columns - 1) * LIBRARY_GRID_GAP_PX) / columns
    : 0;
  const virtualized = items.length >= LIBRARY_VIRTUALIZE_MIN;
  const getItemKey = useCallback((index: number) => items[index].id, [items]);
  const estimateSize = useCallback(
    (index: number) =>
      items[index]
        ? estimateLibraryGridItemHeight(items[index], columnWidth)
        : LIBRARY_GRID_ROW_ESTIMATE_PX,
    [columnWidth, items],
  );
  const rangeExtractor = useCallback((range: Parameters<typeof defaultRangeExtractor>[0]) => (
    virtualized
      ? defaultRangeExtractor(range)
      : Array.from({ length: items.length }, (_, index) => index)
  ), [items.length, virtualized]);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    getItemKey,
    estimateSize,
    lanes: columns,
    // Keep each card in its column as images load; only its vertical position changes.
    laneAssignmentMode: "estimate",
    gap: LIBRARY_GRID_GAP_PX,
    overscan: columns * 4,
    scrollMargin,
    rangeExtractor,
    directDomUpdates: true,
    useAnimationFrameWithResizeObserver: true,
    useFlushSync: false,
  });

  const setGridRef = useCallback((node: HTMLUListElement | null) => {
    gridRef.current = node;
    virtualizer.containerRef(node);
  }, [virtualizer]);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    let frame = 0;
    let nextWidth = Math.round(grid.clientWidth);
    const commitWidth = () => {
      frame = 0;
      setWidth((current) => current === nextWidth ? current : nextWidth);
    };
    const observer = new ResizeObserver(([entry]) => {
      nextWidth = Math.round(entry.contentRect.width);
      if (!frame) frame = requestAnimationFrame(commitWidth);
    });
    setWidth(nextWidth);
    observer.observe(grid);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Status messages above the grid are part of the same scroll container.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    const scroll = scrollRef.current;
    if (grid && scroll) {
      const margin = grid.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
      if (margin !== scrollMargin) setScrollMargin(margin);
    }
  }, [scrollRef, scrollMargin, width]);

  useLayoutEffect(() => {
    virtualizer.measure();
  }, [width, virtualizer]);

  return (
    <ul ref={setGridRef} aria-label="Library items" data-masonry-scope={scopeKey} className="relative w-full">
      {virtualizer.getVirtualItems().map(cell => renderItem(items[cell.index], {
        index: cell.index,
        measureElement: virtualizer.measureElement,
        style: {
          position: "absolute",
          top: 0,
          insetInlineStart: cell.lane * (columnWidth + LIBRARY_GRID_GAP_PX),
          width: width ? columnWidth : "100%",
        },
      }))}
    </ul>
  );
}
