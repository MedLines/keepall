import type { Item } from "./item";

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** Case-insensitive substring match on item text fields and resolved tag names. */
export function matchesSearchQuery(
  item: Item,
  query: string,
  tagNames: readonly string[] = [],
): boolean {
  const needle = normalizeSearchQuery(query);

  if (!needle) {
    return true;
  }

  if (tagNames.some((name) => name.toLowerCase().includes(needle))) {
    return true;
  }

  if (item.type === "note") {
    return (
      item.title.toLowerCase().includes(needle) ||
      item.content.toLowerCase().includes(needle)
    );
  }

  if (item.type === "image") {
    return (
      item.title.toLowerCase().includes(needle) ||
      item.caption.toLowerCase().includes(needle) ||
      item.sourceUrl.toLowerCase().includes(needle)
    );
  }

  if (item.type === "video") return item.title.toLowerCase().includes(needle) || item.sourceFileName.toLowerCase().includes(needle) || item.noteContent?.toLowerCase().includes(needle);
  return (
    item.title.toLowerCase().includes(needle) ||
    item.url.toLowerCase().includes(needle)
  );
}
