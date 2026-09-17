"use client";

import { type ReactNode, type RefObject } from "react";
import type { Item } from "@/domain/item";
import type { LibraryLayout } from "@/domain/library-view";
import { LibraryVirtualItems } from "./library-virtual-items";
import { LIBRARY_VIRTUALIZE_MIN } from "./library-scale";

type Props = {
  visibleItems: Item[];
  scopeKey: string;
  layout: LibraryLayout;
  scrollRef: RefObject<HTMLElement | null>;
  empty: ReactNode;
  renderItem: (item: Item) => ReactNode;
};

/** Grid/list body — virtualizes at 60+ visible so leaving a big folder unmounts ~30 cards, not 396. */
export function LibraryMainGrid({
  visibleItems,
  scopeKey,
  layout,
  scrollRef,
  empty,
  renderItem,
}: Props) {
  if (visibleItems.length === 0) {
    return empty;
  }

  const useVirtualList = visibleItems.length >= LIBRARY_VIRTUALIZE_MIN;

  if (useVirtualList) {
    return (
      <LibraryVirtualItems
        scopeKey={scopeKey}
        items={visibleItems}
        layout={layout}
        scrollRef={scrollRef}
        renderItem={renderItem}
      />
    );
  }

  return (
    <ul
      className={
        layout === "list"
          ? "flex flex-col gap-2"
          : "grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4"
      }
    >
      {visibleItems.map((item) => renderItem(item))}
    </ul>
  );
}
