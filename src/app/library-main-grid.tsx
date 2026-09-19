"use client";

import { type ReactNode, type RefObject } from "react";
import type { Item } from "@/domain/item";
import type { LibraryLayout } from "@/domain/library-view";
import { LibraryVirtualItems } from "./library-virtual-items";
import { LIBRARY_VIRTUALIZE_MIN } from "./library-scale";
import { LibraryMasonry, type MasonryPlacement } from "./library-masonry";

type Props = {
  visibleItems: Item[];
  scopeKey: string;
  layout: LibraryLayout;
  scrollRef: RefObject<HTMLElement | null>;
  empty: ReactNode;
  renderItem: (item: Item, placement?: MasonryPlacement) => ReactNode;
};

/** Both views window large libraries; grid cards keep their natural heights. */
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

  if (layout === "grid") {
    return <LibraryMasonry key={scopeKey} items={visibleItems} scopeKey={scopeKey} scrollRef={scrollRef} renderItem={renderItem} />;
  }

  const useVirtualList = visibleItems.length >= LIBRARY_VIRTUALIZE_MIN;

  if (useVirtualList) {
    return (
      <LibraryVirtualItems
        key={scopeKey}
        items={visibleItems}
        scrollRef={scrollRef}
        renderItem={renderItem}
      />
    );
  }

  return (
    <ul className="flex flex-col" aria-label="Library items">
      {visibleItems.map((item) => renderItem(item))}
    </ul>
  );
}
