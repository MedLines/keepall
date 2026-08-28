import type { Item } from "@/domain/item";
import type { LibraryTypeFilter } from "@/domain/library-view";

/** Sidebar badge counts — computed once per `items` change in Library. */
export type LibrarySidebarCounts = {
  all: number;
  unsorted: number;
  byType: Record<LibraryTypeFilter, number>;
  byCollectionId: Record<string, number>;
  byTagId: Record<string, number>;
};

export function countSidebarItems(items: Item[]): LibrarySidebarCounts {
  const byCollectionId: Record<string, number> = {};
  const byTagId: Record<string, number> = {};
  const byType: Record<LibraryTypeFilter, number> = {
    link: 0,
    note: 0,
    image: 0,
  };
  let unsorted = 0;

  for (const item of items) {
    byType[item.type] += 1;
    if (item.collectionIds.length === 0) {
      unsorted += 1;
    }
    for (const id of item.collectionIds) {
      byCollectionId[id] = (byCollectionId[id] ?? 0) + 1;
    }
    for (const id of item.tagIds) {
      byTagId[id] = (byTagId[id] ?? 0) + 1;
    }
  }

  return {
    all: items.length,
    unsorted,
    byType,
    byCollectionId,
    byTagId,
  };
}
