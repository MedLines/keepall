import {
  coerceLinkPreviewFields,
  linkListTitle,
  type LinkItem,
} from "./link";
import { coerceImageFields, imageListTitle, type ImageItem } from "./image";
import { noteListTitle, type NoteItem } from "./note";

export type Item = NoteItem | LinkItem | ImageItem;

export type ItemWithOptionalOrgIds = {
  tagIds?: string[];
  collectionIds?: string[];
};

export function normalizeItem<T extends ItemWithOptionalOrgIds>(
  item: T,
): T & { tagIds: string[]; collectionIds: string[] } {
  const withOrg = {
    ...item,
    tagIds: item.tagIds ?? [],
    collectionIds: item.collectionIds ?? [],
  };

  if ("type" in withOrg && (withOrg as { type?: string }).type === "link") {
    return {
      ...withOrg,
      ...coerceLinkPreviewFields(withOrg as Partial<LinkItem>),
    };
  }

  if ("type" in withOrg && (withOrg as { type?: string }).type === "image") {
    return {
      ...withOrg,
      ...coerceImageFields(withOrg as Partial<ImageItem>),
    };
  }

  return withOrg;
}

export function itemListTitle(item: Item): string {
  if (item.type === "note") {
    return noteListTitle(item);
  }
  if (item.type === "image") {
    return imageListTitle(item);
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
