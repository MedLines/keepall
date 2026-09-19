"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, type RefObject } from "react";
import type { Item } from "@/domain/item";
import { LIBRARY_LIST_ROW_ESTIMATE_PX } from "./library-scale";

type Props = {
  items: Item[];
  scrollRef: RefObject<HTMLElement | null>;
  renderItem: (item: Item) => ReactNode;
};

/** List-view rows. The grid uses independently measured masonry cards. */
export function LibraryVirtualItems({
  items,
  scrollRef,
  renderItem,
}: Props) {
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getItemKey: (index) => items[index].id,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => LIBRARY_LIST_ROW_ESTIMATE_PX,
    overscan: 10,
    directDomUpdates: true,
    useAnimationFrameWithResizeObserver: true,
    useFlushSync: false,
  });

  return (
    <div
      ref={rowVirtualizer.containerRef}
      className="relative w-full"
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const rowIndex = virtualRow.index;

        return (
          <div
            key={virtualRow.key}
            ref={rowVirtualizer.measureElement}
            data-index={virtualRow.index}
            className="absolute left-0 top-0 w-full focus-within:z-10 has-[details[open]]:z-10"
          >
            <ul className="flex flex-col">
              {renderItem(items[rowIndex])}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
