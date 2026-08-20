import { linkListTitle, type LinkItem } from "./link";
import { noteListTitle, type NoteItem } from "./note";

export type Item = NoteItem | LinkItem;

export type ItemWithOptionalOrgIds = {
  tagIds?: string[];
  collectionIds?: string[];
};

export function normalizeItem<T extends ItemWithOptionalOrgIds>(
  item: T,
): T & { tagIds: string[]; collectionIds: string[] } {
  return {
    ...item,
    tagIds: item.tagIds ?? [],
    collectionIds: item.collectionIds ?? [],
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

export function resolveItemCollectionNames(
  item: Item,
  collectionsById: Map<string, { name: string }>,
): string[] {
  return item.collectionIds
    .map((id) => collectionsById.get(id)?.name)
    .filter((name): name is string => Boolean(name));
}

export function itemInCollection(item: Item, collectionId: string): boolean {
  return item.collectionIds.includes(collectionId);
}
