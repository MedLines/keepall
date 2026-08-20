import type { Item } from "./item";

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** Case-insensitive substring match on item-owned text fields only. */
export function matchesSearchQuery(item: Item, query: string): boolean {
  const needle = normalizeSearchQuery(query);

  if (!needle) {
    return true;
  }

  if (item.type === "note") {
    return (
      item.title.toLowerCase().includes(needle) ||
      item.content.toLowerCase().includes(needle)
    );
  }

  return (
    item.title.toLowerCase().includes(needle) ||
    item.url.toLowerCase().includes(needle)
  );
}
