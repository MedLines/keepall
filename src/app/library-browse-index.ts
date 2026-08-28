import type { Item } from "@/domain/item";
import type { LibraryViewState } from "@/domain/library-view";
import type { Tag } from "@/domain/tag";
import type { Collection } from "@/domain/collection";
import {
  itemHasTag,
  itemInCollection,
  itemIsUnsorted,
  resolveItemTagNames,
} from "@/domain/item";
import { matchesSearchQuery } from "@/domain/search";
import { sortLibraryItemsWithCollectionPins } from "@/domain/library-view";

/** Precomputed pools so folder/tag/type browse avoids scanning the whole library. */
export type LibraryBrowseIndexes = {
  byCollection: Map<string, Item[]>;
  unsorted: Item[];
  byTag: Map<string, Item[]>;
  byType: Map<Item["type"], Item[]>;
};

export function buildLibraryBrowseIndexes(items: Item[]): LibraryBrowseIndexes {
  const byCollection = new Map<string, Item[]>();
  const unsorted: Item[] = [];
  const byTag = new Map<string, Item[]>();
  const byType = new Map<Item["type"], Item[]>();

  for (const item of items) {
    if (itemIsUnsorted(item)) {
      unsorted.push(item);
    }

    for (const collectionId of item.collectionIds) {
      const list = byCollection.get(collectionId);
      if (list) {
        list.push(item);
      } else {
        byCollection.set(collectionId, [item]);
      }
    }

    for (const tagId of item.tagIds) {
      const list = byTag.get(tagId);
      if (list) {
        list.push(item);
      } else {
        byTag.set(tagId, [item]);
      }
    }

    const typeList = byType.get(item.type);
    if (typeList) {
      typeList.push(item);
    } else {
      byType.set(item.type, [item]);
    }
  }

  return { byCollection, unsorted, byTag, byType };
}

function replaceInItemPool(list: Item[], itemId: string, next: Item): boolean {
  const index = list.findIndex((row) => row.id === itemId);
  if (index === -1) {
    return false;
  }
  list[index] = next;
  return true;
}

/** Swap one row inside precomputed pools after enrich patch — avoids rebuilding 719 entries. */
export function replaceItemInBrowseIndexes(
  indexes: LibraryBrowseIndexes,
  itemId: string,
  next: Item,
): boolean {
  let changed = false;
  if (replaceInItemPool(indexes.unsorted, itemId, next)) {
    changed = true;
  }
  for (const list of indexes.byCollection.values()) {
    if (replaceInItemPool(list, itemId, next)) {
      changed = true;
    }
  }
  for (const list of indexes.byTag.values()) {
    if (replaceInItemPool(list, itemId, next)) {
      changed = true;
    }
  }
  for (const list of indexes.byType.values()) {
    if (replaceInItemPool(list, itemId, next)) {
      changed = true;
    }
  }
  return changed;
}

function browseCandidatePool(
  items: Item[],
  view: LibraryViewState,
  indexes: LibraryBrowseIndexes,
): Item[] {
  if (view.collection !== null) {
    return indexes.byCollection.get(view.collection) ?? [];
  }
  if (view.unsorted) {
    return indexes.unsorted;
  }
  if (view.tag !== null) {
    return indexes.byTag.get(view.tag) ?? [];
  }
  if (view.type !== null) {
    return indexes.byType.get(view.type) ?? [];
  }
  return items;
}

export function filterAndSortLibraryItems(
  items: Item[],
  tags: Tag[],
  view: LibraryViewState,
  collectionsById: Map<string, Collection>,
  indexes: LibraryBrowseIndexes,
): Item[] {
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]));
  const collectionId = view.collection;
  const collection =
    collectionId !== null ? (collectionsById.get(collectionId) ?? null) : null;
  const pool = browseCandidatePool(items, view, indexes);

  return sortLibraryItemsWithCollectionPins(
    pool.filter((item) => {
      if (view.type !== null && item.type !== view.type) {
        return false;
      }
      if (collectionId !== null && !itemInCollection(item, collectionId)) {
        return false;
      }
      if (view.unsorted && !itemIsUnsorted(item)) {
        return false;
      }
      if (view.tag !== null && !itemHasTag(item, view.tag)) {
        return false;
      }
      return matchesSearchQuery(
        item,
        view.q,
        resolveItemTagNames(item, tagMap),
      );
    }),
    view.sort,
    collectionId !== null ? (collection?.pinnedItemIds ?? null) : null,
  );
}
