import type { Item } from "./item";

export type LibrarySort = "newest" | "oldest";

/** Item kind filter; null means All types. */
export type LibraryTypeFilter = "link" | "note" | "image";

/** How the library paints items; null/grid is default. */
export type LibraryLayout = "grid" | "list";

export type LibraryViewState = {
  q: string;
  collection: string | null;
  /** Active tag filter id; null when showing all tags. */
  tag: string | null;
  /** Active type filter; null when All. */
  type: LibraryTypeFilter | null;
  /** grid (default) or list; omitted from URL when grid. */
  layout: LibraryLayout;
  sort: LibrarySort;
  /** Open library item id for inspect overlay; null when closed. */
  item: string | null;
  /** Zero-based image gallery index in inspect; omitted from URL when 0. */
  slide: number;
};

export const DEFAULT_LIBRARY_SORT: LibrarySort = "newest";
export const DEFAULT_LIBRARY_LAYOUT: LibraryLayout = "grid";

export function parseLibrarySort(value: string | null): LibrarySort {
  return value === "oldest" ? "oldest" : "newest";
}

export function parseLibraryType(
  value: string | null,
): LibraryTypeFilter | null {
  if (value === "link" || value === "note" || value === "image") {
    return value;
  }
  return null;
}

export function parseLibraryLayout(value: string | null): LibraryLayout {
  return value === "list" ? "list" : "grid";
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

  return {
    q: params.get("q") ?? "",
    collection,
    tag,
    type: parseLibraryType(params.get("type")),
    layout: parseLibraryLayout(params.get("layout")),
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

  if (q) {
    params.set("q", q);
  }

  if (state.collection) {
    params.set("collection", state.collection);
  }

  if (state.tag) {
    params.set("tag", state.tag);
  }

  if (state.type) {
    params.set("type", state.type);
  }

  if (state.layout !== DEFAULT_LIBRARY_LAYOUT) {
    params.set("layout", state.layout);
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

export function sortLibraryItems<T extends Pick<Item, "createdAt">>(
  items: T[],
  sort: LibrarySort,
): T[] {
  const copy = [...items];
  copy.sort((a, b) =>
    sort === "newest" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
  );
  return copy;
}

/** Pinned ids first (stable array order), then remaining items by sort. Ignored when pins is null. */
export function sortLibraryItemsWithCollectionPins<
  T extends Pick<Item, "id" | "createdAt">,
>(items: T[], sort: LibrarySort, pinnedItemIds: string[] | null): T[] {
  if (!pinnedItemIds || pinnedItemIds.length === 0) {
    return sortLibraryItems(items, sort);
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
  );
  return [...pinned, ...rest];
}

export function mergeLibraryViewState(
  current: LibraryViewState,
  patch: Partial<LibraryViewState>,
): LibraryViewState {
  return {
    q: patch.q !== undefined ? patch.q : current.q,
    collection:
      patch.collection !== undefined ? patch.collection : current.collection,
    tag: patch.tag !== undefined ? patch.tag : current.tag,
    type: patch.type !== undefined ? patch.type : current.type,
    layout: patch.layout !== undefined ? patch.layout : current.layout,
    sort: patch.sort !== undefined ? patch.sort : current.sort,
    item: patch.item !== undefined ? patch.item : current.item,
    slide: patch.slide !== undefined ? patch.slide : current.slide,
  };
}

/** Shared Motion layoutId for card media ↔ inspect media morph. */
export function itemMediaLayoutId(itemId: string): string {
  return `keepall-item-media-${itemId}`;
}
