import type { Item } from "./item";

export type LibrarySort = "newest" | "oldest";

export type LibraryViewState = {
  q: string;
  collection: string | null;
  sort: LibrarySort;
  /** Open library item id for inspect overlay; null when closed. */
  item: string | null;
};

export const DEFAULT_LIBRARY_SORT: LibrarySort = "newest";

export function parseLibrarySort(value: string | null): LibrarySort {
  return value === "oldest" ? "oldest" : "newest";
}

export function parseLibraryViewState(
  params: URLSearchParams,
): LibraryViewState {
  const collection = params.get("collection")?.trim() || null;
  const item = params.get("item")?.trim() || null;

  return {
    q: params.get("q") ?? "",
    collection,
    sort: parseLibrarySort(params.get("sort")),
    item,
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

  if (state.sort !== DEFAULT_LIBRARY_SORT) {
    params.set("sort", state.sort);
  }

  if (state.item) {
    params.set("item", state.item);
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

export function mergeLibraryViewState(
  current: LibraryViewState,
  patch: Partial<LibraryViewState>,
): LibraryViewState {
  return {
    q: patch.q !== undefined ? patch.q : current.q,
    collection:
      patch.collection !== undefined ? patch.collection : current.collection,
    sort: patch.sort !== undefined ? patch.sort : current.sort,
    item: patch.item !== undefined ? patch.item : current.item,
  };
}

/** Shared Motion layoutId for card media ↔ inspect media morph. */
export function itemMediaLayoutId(itemId: string): string {
  return `keepall-item-media-${itemId}`;
}
