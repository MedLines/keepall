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
  const virtualized = items.length >= LIBRARY_VIRTUALIZE_MIN;
  const getItemKey = useCallback((index: number) => items[index].id, [items]);
  const rangeExtractor = useCallback((range: Parameters<typeof defaultRangeExtractor>[0]) => (
    virtualized
      ? defaultRangeExtractor(range)
      : Array.from({ length: items.length }, (_, index) => index)
  ), [items.length, virtualized]);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    getItemKey,
    estimateSize: () => LIBRARY_GRID_ROW_ESTIMATE_PX,
    lanes: columns,
    // Keep each card in its column as images load; only its vertical position changes.
    laneAssignmentMode: "estimate",
    gap: LIBRARY_GRID_GAP_PX,
    overscan: columns * 4,
    scrollMargin,
    rangeExtractor,
  });

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    setWidth(grid.clientWidth);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  // Status messages above the grid are part of the same scroll container.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    const scroll = scrollRef.current;
    if (grid && scroll) {
      const margin = grid.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
      if (margin !== scrollMargin) setScrollMargin(margin);
    }
  }, [scrollRef, scrollMargin, width, renderItem]);

  useLayoutEffect(() => {
    virtualizer.measure();
    // Width changes invalidate off-screen sizes too. Refresh mounted cards now,
    // even when their height stayed the same and ResizeObserver would stay silent.
    gridRef.current?.querySelectorAll<HTMLLIElement>(":scope > li").forEach(virtualizer.measureElement);
  }, [width, virtualizer]);

  useLayoutEffect(() => {
    virtualizer.scrollToOffset(0);
  }, [scopeKey, virtualizer]);

  const columnWidth = (width - (columns - 1) * LIBRARY_GRID_GAP_PX) / columns;

  return (
    <ul ref={gridRef} aria-label="Library items" className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map(cell => renderItem(items[cell.index], {
        index: cell.index,
        measureElement: virtualizer.measureElement,
        style: {
          position: "absolute",
          top: 0,
          insetInlineStart: cell.lane * (columnWidth + LIBRARY_GRID_GAP_PX),
          width: width ? columnWidth : "100%",
          transform: `translateY(${cell.start - scrollMargin}px)`,
        },
      }))}
    </ul>
  );
}
