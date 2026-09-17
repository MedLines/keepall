"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { Item } from "@/domain/item";
import type { LibraryLayout } from "@/domain/library-view";
import {
  LIBRARY_GRID_GAP_PX,
  LIBRARY_GRID_MIN_COL_PX,
  LIBRARY_GRID_ROW_ESTIMATE_PX,
  LIBRARY_LIST_ROW_ESTIMATE_PX,
} from "./library-scale";

type Props = {
  items: Item[];
  layout: LibraryLayout;
  scrollRef: RefObject<HTMLElement | null>;
  /** Scroll to top when the filtered set changes — virtualizer instance is reused. */
  scopeKey: string;
  renderItem: (item: Item) => ReactNode;
};

function gridColumnCount(containerWidth: number): number {
  return Math.max(
    1,
    Math.floor(
      (containerWidth + LIBRARY_GRID_GAP_PX) /
        (LIBRARY_GRID_MIN_COL_PX + LIBRARY_GRID_GAP_PX),
    ),
  );
}

/** Virtualized library rows — list (1 col) or grid (N cols per row). */
export function LibraryVirtualItems({
  items,
  layout,
  scrollRef,
  scopeKey,
  renderItem,
}: Props) {
  const [containerWidth, setContainerWidth] = useState(0);
  const isList = layout === "list";

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      const style = getComputedStyle(element);
      setContainerWidth(element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollRef]);

  const columnCount = useMemo(
    () => (isList ? 1 : gridColumnCount(containerWidth)),
    [containerWidth, isList],
  );

  const rowCount = isList
    ? items.length
    : Math.ceil(items.length / columnCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () =>
      isList ? LIBRARY_LIST_ROW_ESTIMATE_PX : LIBRARY_GRID_ROW_ESTIMATE_PX,
    overscan: isList ? 10 : 5,
  });

  useEffect(() => {
    rowVirtualizer.scrollToOffset(0);
  }, [scopeKey, rowVirtualizer]);

  useEffect(() => {
    rowVirtualizer.measure();
  }, [scopeKey, columnCount, isList, items.length, rowVirtualizer]);

  return (
    <div
      className="relative w-full"
      style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const rowIndex = virtualRow.index;
        const rowItems = isList
          ? [items[rowIndex]]
          : items.slice(
              rowIndex * columnCount,
              rowIndex * columnCount + columnCount,
            );

        return (
          <div
            key={virtualRow.key}
            ref={rowVirtualizer.measureElement}
            data-index={virtualRow.index}
            className={`absolute left-0 top-0 w-full ${isList ? "" : "pb-5"}`}
            style={{ transform: `translateY(${virtualRow.start}px)` }}
          >
            <ul
              className={isList ? "flex flex-col gap-2" : "grid items-start gap-5"}
              style={
                isList
                  ? undefined
                  : {
                      gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                    }
              }
            >
              {rowItems.map((item) => renderItem(item))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
