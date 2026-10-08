import type { Item } from "./item";

export type LibrarySort = "newest" | "oldest" | "relevance";

/** One item kind in the type filter. */
export type LibraryTypeFilter = "link" | "note" | "image" | "video" | "document";
export type LibraryTypeSelection = LibraryTypeFilter | LibraryTypeFilter[] | null;

const LIBRARY_TYPES: LibraryTypeFilter[] = ["image", "video", "link", "note", "document"];
const TYPE_LABELS: Record<LibraryTypeFilter, string> = {
  image: "Images", video: "Videos", link: "Links", note: "Notes", document: "Documents",
};

export function selectedLibraryTypes(value: LibraryTypeSelection): LibraryTypeFilter[] {
  return value === null ? [] : Array.isArray(value) ? value : [value];
}

export function libraryTypeSelectionLabel(value: LibraryTypeSelection): string | null {
  const types = selectedLibraryTypes(value);
  return types.length ? types.map(type => TYPE_LABELS[type]).join(", ") : null;
}

/** How the library paints items; null/grid is default. */
export type LibraryLayout = "grid" | "list";
export type LibraryListColumns = "auto" | "1" | "2" | "3";

export type LibraryViewState = {
  q: string;
  /** Show all collections as folders instead of library items. */
  collections?: boolean;
  /** Browse tags as label cards instead of library items. */
  tags?: boolean;
  /** Trash is a library scope, independent of the active library. */
  trash?: boolean;
  collection: string | null;
  /** Items with no collection. Ignored when `collection` is set. */
  unsorted: boolean;
  /** Active tag filter id; null when showing all tags. */
  tag: string | null;
  /** Selected types are combined with OR; null means All. */
  type: LibraryTypeSelection;
  /** grid (default) or list; omitted from URL when grid. */
  layout: LibraryLayout;
  /** List column limit; omitted for automatic sizing. */
  listColumns?: LibraryListColumns;
  sort: LibrarySort;
  /** Open library item id for inspect overlay; null when closed. */
  item: string | null;
  /** Zero-based image gallery index in inspect; omitted from URL when 0. */
  slide: number;
};

export const DEFAULT_LIBRARY_SORT: LibrarySort = "newest";
export const DEFAULT_LIBRARY_LAYOUT: LibraryLayout = "grid";

function isCollectionOverviewScope(
  view: Pick<LibraryViewState, "collection" | "unsorted" | "tag" | "type" | "trash">,
): boolean {
  return !view.collection && !view.unsorted && !view.tag && !view.type && !view.trash;
}

export function parseLibrarySort(value: string | null): LibrarySort {
  return value === "oldest" || value === "relevance" ? value : "newest";
}

export function parseLibraryType(
  value: string | null,
): LibraryTypeSelection {
  const requested = new Set(value?.split(",").map(type => type.trim()));
  const types = LIBRARY_TYPES.filter(type => requested.has(type));
  return types.length > 1 ? types : types[0] ?? null;
}

export function parseLibraryLayout(value: string | null): LibraryLayout {
  return value === "list" ? "list" : "grid";
}

export function parseLibraryListColumns(value: string | null): LibraryListColumns {
  return value === "1" || value === "2" || value === "3" ? value : "auto";
}

export function parseLibrarySlide(value: string | null): number {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

export function parseLibraryViewState(
  params: URLSearchParams,
): LibraryViewState {
  const collection = params.get("collection")?.trim() || null;
  const tag = params.get("tag")?.trim() || null;
  const item = params.get("item")?.trim() || null;
  const slide = item ? parseLibrarySlide(params.get("slide")) : 0;
  const unsorted = collection
    ? false
    : params.get("unsorted") === "1";
  const type = parseLibraryType(params.get("type"));
  const trash = params.get("trash") === "1";
  const listColumns = parseLibraryListColumns(params.get("columns"));

  return {
    q: params.get("q") ?? "",
    ...(params.get("collections") === "1" && isCollectionOverviewScope({ collection, unsorted, tag, type, trash })
      ? { collections: true } : {}),
    ...(params.get("tags") === "1" && params.get("collections") !== "1" && isCollectionOverviewScope({ collection, unsorted, tag, type, trash })
      ? { tags: true } : {}),
    ...(trash ? { trash: true } : {}),
    collection,
    unsorted,
    tag,
    type,
    layout: parseLibraryLayout(params.get("layout")),
    ...(listColumns !== "auto" ? { listColumns } : {}),
    sort: parseLibrarySort(params.get("sort")),
    item,
    slide,
  };
}

export function libraryViewStateToSearchParams(
  state: LibraryViewState,
): URLSearchParams {
  const params = new URLSearchParams();
  const q = state.q.trim();
  if (state.collections) params.set("collections", "1");
  if (state.tags) params.set("tags", "1");
  if (state.trash) params.set("trash", "1");

  if (q) {
    params.set("q", q);
  }

  if (state.collection) {
    params.set("collection", state.collection);
  } else if (state.unsorted) {
    params.set("unsorted", "1");
  }

  if (state.tag) {
    params.set("tag", state.tag);
  }

  if (state.type) {
    params.set("type", selectedLibraryTypes(state.type).join(","));
  }

  if (state.layout !== DEFAULT_LIBRARY_LAYOUT) {
    params.set("layout", state.layout);
  }

  if (state.listColumns && state.listColumns !== "auto") {
    params.set("columns", state.listColumns);
  }

  if (state.sort !== DEFAULT_LIBRARY_SORT) {
    params.set("sort", state.sort);
  }

  if (state.item) {
    params.set("item", state.item);
    if (state.slide > 0) {
      params.set("slide", String(state.slide));
    }
  }

  return params;
}

export function libraryViewHref(
  pathname: string,
  state: LibraryViewState,
): string {
  const query = libraryViewStateToSearchParams(state).toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function sortLibraryItems<T extends Pick<Item, "id" | "createdAt">>(
  items: T[],
  sort: LibrarySort,
  searchScores?: ReadonlyMap<string, number>,
): T[] {
  const copy = [...items];
  copy.sort((a, b) => {
    if (sort === "relevance") {
      const difference = (searchScores?.get(b.id) ?? 0) - (searchScores?.get(a.id) ?? 0);
      if (difference) return difference;
    }
    return sort === "oldest" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt;
  });
  return copy;
}

/** Pinned ids first (stable array order), then remaining items by sort. Ignored when pins is null. */
export function sortLibraryItemsWithCollectionPins<
  T extends Pick<Item, "id" | "createdAt">,
>(items: T[], sort: LibrarySort, pinnedItemIds: string[] | null, searchScores?: ReadonlyMap<string, number>): T[] {
  if (!pinnedItemIds || pinnedItemIds.length === 0) {
    return sortLibraryItems(items, sort, searchScores);
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  const pinned: T[] = [];
  for (const id of pinnedItemIds) {
    const item = byId.get(id);
    if (item) {
      pinned.push(item);
    }
  }

  const pinnedSet = new Set(pinned.map((item) => item.id));
  const rest = sortLibraryItems(
    items.filter((item) => !pinnedSet.has(item.id)),
    sort,
    searchScores,
  );
  return [...pinned, ...rest];
}

export function mergeLibraryViewState(
  current: LibraryViewState,
  patch: Partial<LibraryViewState>,
): LibraryViewState {
  let collection =
    patch.collection !== undefined ? patch.collection : current.collection;
  let unsorted =
    patch.unsorted !== undefined ? patch.unsorted : current.unsorted;
  const type = patch.type !== undefined ? patch.type : current.type;
  const tag = patch.tag !== undefined ? patch.tag : current.tag;
  const trash = patch.trash ?? current.trash;

  if (patch.collection) {
    unsorted = false;
  } else if (patch.unsorted === true) {
    collection = null;
    unsorted = true;
  } else if (collection) {
    unsorted = false;
  }

  return {
    q: patch.q !== undefined ? patch.q : current.q,
    ...((patch.collections ?? current.collections) && patch.tags !== true && isCollectionOverviewScope({ collection, unsorted, tag, type, trash })
      ? { collections: true } : {}),
    ...((patch.tags ?? current.tags) && patch.collections !== true && isCollectionOverviewScope({ collection, unsorted, tag, type, trash })
      ? { tags: true } : {}),
    ...(trash ? { trash: true } : {}),
    collection,
    unsorted,
    tag,
    type,
    layout: patch.layout !== undefined ? patch.layout : current.layout,
    ...((patch.listColumns ?? current.listColumns) ? { listColumns: patch.listColumns ?? current.listColumns } : {}),
    sort: patch.sort !== undefined ? patch.sort : current.sort,
    item: patch.item !== undefined ? patch.item : current.item,
    slide: patch.slide !== undefined ? patch.slide : current.slide,
  };
}

/** Shared Motion layoutId for card media ↔ inspect media morph. */
export function itemMediaLayoutId(itemId: string): string {
  return `keepall-item-media-${itemId}`;
}
