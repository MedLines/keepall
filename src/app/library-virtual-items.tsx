"use client";

import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, type ReactNode, type RefObject } from "react";
import type { Item } from "@/domain/item";
import { LIBRARY_LIST_GAP_PX, LIBRARY_LIST_ROW_ESTIMATE_PX } from "./library-scale";
import type { MasonryPlacement } from "./library-masonry";

type Props = {
  items: Item[];
  scrollRef: RefObject<HTMLElement | null>;
  renderItem: (item: Item, placement: MasonryPlacement) => ReactNode;
  focusedIndex?: number;
  columns?: number;
};

/** List-view rows. The grid uses independently measured masonry cards. */
export function LibraryVirtualItems({
  items,
  scrollRef,
  renderItem,
  focusedIndex = -1,
  columns = 1,
}: Props) {
  const rangeExtractor = useCallback((range: Parameters<typeof defaultRangeExtractor>[0]) =>
    [...new Set([...defaultRangeExtractor(range), ...(focusedIndex >= 0 ? [focusedIndex] : [])])].sort((a, b) => a - b), [focusedIndex]);
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getItemKey: (index) => items[index].id,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => LIBRARY_LIST_ROW_ESTIMATE_PX,
    lanes: columns,
    laneAssignmentMode: "estimate",
    gap: LIBRARY_LIST_GAP_PX,
    overscan: columns * 10,
    rangeExtractor,
    directDomUpdates: true,
    useAnimationFrameWithResizeObserver: true,
    // New ranges must mount before the browser paints a fast scroll jump.
    useFlushSync: true,
  });

  return (
    <ul
      ref={rowVirtualizer.containerRef}
      className="library-list relative w-full"
      aria-label="Library items"
    >
      {rowVirtualizer.getVirtualItems().map(row => renderItem(items[row.index], {
        index: row.index,
        measureElement: rowVirtualizer.measureElement,
        style: {
          position: "absolute", top: 0,
          insetInlineStart: `calc(${row.lane} * ((100% - ${(columns - 1) * LIBRARY_LIST_GAP_PX}px) / ${columns} + ${LIBRARY_LIST_GAP_PX}px))`,
          width: `calc((100% - ${(columns - 1) * LIBRARY_LIST_GAP_PX}px) / ${columns})`,
        },
      }))}
    </ul>
  );
}
