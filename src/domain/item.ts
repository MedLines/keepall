import {
  coerceLinkPreviewFields,
  linkListTitle,
  type LinkItem,
} from "./link";
import { coerceImageFields, imageListTitle, type ImageItem } from "./image";
import { noteListTitle, type NoteItem } from "./note";
import type { VideoItem } from "./video";
import { coerceExclusiveCollectionIds } from "./collection";

export type Item = NoteItem | LinkItem | ImageItem | VideoItem;

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
    collectionIds: coerceExclusiveCollectionIds(item.collectionIds ?? []),
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

  if ("type" in withOrg && (withOrg as { type?: string }).type === "video") {
    return { ...withOrg, noteContent: (withOrg as Partial<VideoItem>).noteContent ?? "" };
  }

  return withOrg;
}

export function itemListTitle(item: Item): string {
  if (item.type === "note") {
    return noteListTitle(item);
  }
  if (item.type === "image") return imageListTitle(item);
  if (item.type === "video") return item.title || "Video";
  return linkListTitle(item);
}

export function resolveItemTagNames(
  item: Item,
  tagsById: Map<string, { name: string }>,
): string[] {
  return resolveItemTags(item, tagsById).map((tag) => tag.name);
}

/** Tags on an item that still exist in the library (id + display name). */
export function resolveItemTags(
  item: Item,
  tagsById: Map<string, { name: string }>,
): { id: string; name: string }[] {
  return item.tagIds
    .map((id) => {
      const name = tagsById.get(id)?.name;
      return name ? { id, name } : null;
    })
    .filter((tag): tag is { id: string; name: string } => tag !== null);
}

export function itemHasTag(item: Item, tagId: string): boolean {
  return item.tagIds.includes(tagId);
}

export function resolveItemCollectionNames(
  item: Item,
  collectionsById: Map<string, { name: string }>,
): string[] {
  return item.collectionIds
    .map((id) => collectionsById.get(id)?.name)
    .filter((name): name is string => Boolean(name));
}

export function resolveItemCollections(
  item: Item,
  collectionsById: Map<string, { name: string }>,
): { id: string; name: string }[] {
  return item.collectionIds
    .map((id) => {
      const name = collectionsById.get(id)?.name;
      return name ? { id, name } : null;
    })
    .filter(
      (collection): collection is { id: string; name: string } =>
        collection !== null,
    );
}

export function itemInCollection(item: Item, collectionId: string): boolean {
  return item.collectionIds.includes(collectionId);
}

/** Captured without a collection — the Unsorted inbox. */
export function itemIsUnsorted(item: Item): boolean {
  return item.collectionIds.length === 0;
}
