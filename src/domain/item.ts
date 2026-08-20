import { linkListTitle, type LinkItem } from "./link";
import { noteListTitle, type NoteItem } from "./note";

export type Item = NoteItem | LinkItem;

export type ItemWithOptionalTagIds = {
  tagIds?: string[];
};

export function normalizeItemTagIds<T extends ItemWithOptionalTagIds>(
  item: T,
): T & { tagIds: string[] } {
  return {
    ...item,
    tagIds: item.tagIds ?? [],
  };
}

export function itemListTitle(item: Item): string {
  if (item.type === "note") {
    return noteListTitle(item);
  }

  return linkListTitle(item);
}

export function resolveItemTagNames(
  item: Item,
  tagsById: Map<string, { name: string }>,
): string[] {
  return item.tagIds
    .map((id) => tagsById.get(id)?.name)
    .filter((name): name is string => Boolean(name));
}
