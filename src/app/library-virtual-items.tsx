"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useEffect,
  type ReactNode,
  type RefObject,
} from "react";
import type { Item } from "@/domain/item";
import { LIBRARY_LIST_ROW_ESTIMATE_PX } from "./library-scale";

type Props = {
  items: Item[];
  scrollRef: RefObject<HTMLElement | null>;
  /** Scroll to top when the filtered set changes — virtualizer instance is reused. */
  scopeKey: string;
  renderItem: (item: Item) => ReactNode;
};

/** List-view rows. The grid uses independently measured masonry cards. */
export function LibraryVirtualItems({
  items,
  scrollRef,
  scopeKey,
  renderItem,
}: Props) {
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getItemKey: (index) => items[index].id,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => LIBRARY_LIST_ROW_ESTIMATE_PX,
    overscan: 10,
  });

  useEffect(() => {
    rowVirtualizer.scrollToOffset(0);
  }, [scopeKey, rowVirtualizer]);

  useEffect(() => {
    rowVirtualizer.measure();
  }, [scopeKey, items.length, rowVirtualizer]);

  return (
    <div
      className="relative w-full"
      style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const rowIndex = virtualRow.index;

        return (
          <div
            key={virtualRow.key}
            ref={rowVirtualizer.measureElement}
            data-index={virtualRow.index}
            className="absolute left-0 top-0 w-full focus-within:z-10 has-[details[open]]:z-10"
            style={{ transform: `translateY(${virtualRow.start}px)` }}
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
