import type { Collection } from "./collection";
import { itemListTitle, type Item } from "./item";
import { linkCoverAssetId, linkScreenshots } from "./link-screenshot";
import { findSearchExcerpt, parseSearchTerms, searchRelevanceScore } from "./search";
import type { Tag } from "./tag";

export const AGENT_ITEM_TYPES = ["link", "note", "image", "video", "document"] as const;
export const AGENT_TOOL_NAMES = ["search_items", "get_item", "view_images", "list_collections", "list_tags"] as const;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_QUERY = 500;
const MAX_NAME = 120;
const MAX_ID = 100;
export const MAX_ITEM_IMAGES = 8;
export const MAX_VIEW_ITEMS = 12;
/** Notes, articles, and documents longer than this are cut, and the result says so. */
export const MAX_TEXT_CHARACTERS = 30_000;

export class AgentToolError extends Error {}

export type SearchItemsArgs = { query: string; type?: Item["type"]; collection?: string; tag?: string; hasImages?: boolean; limit: number };
export type GetItemArgs = { id: string; imageOffset: number; maxImages: number };
export type ViewImagesArgs = { ids: string[] };

/** Where an item's picture lives. Resolved and resized by the browser before it leaves the library. */
export type AgentImageRef =
  | { source: "asset"; id: string; label: string }
  | { source: "video-poster"; id: string; label: string }
  | { source: "pdf-page"; id: string; label: string };

export type AgentSearchResult = {
  id: string;
  type: Item["type"];
  title: string;
  url?: string;
  excerpt?: string;
  tags: string[];
  collection?: string;
  images: number;
  openInKeepall: string;
  savedAt: string;
};

export type AgentText = { text: string; truncated?: true };

export type AgentItemDetail = Omit<AgentSearchResult, "excerpt"> & {
  updatedAt: string;
  note?: AgentText;
  caption?: AgentText;
  sourceUrl?: string;
  fileName?: string;
  format?: string;
  imageText?: AgentText;
  palette?: string[];
  article?: { title: string; author?: string; siteName?: string; sourceUrl: string; text: AgentText };
  document?: AgentText;
  preview?: { title: string; description: string };
};

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function optionalName(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim() || value.length > MAX_NAME) throw new AgentToolError(`${field} must be a name of 1 to ${MAX_NAME} characters.`);
  return value.trim();
}

function integer(value: unknown, field: string, min: number, max: number, fallback: number) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new AgentToolError(`${field} must be a whole number from ${min} to ${max}.`);
  return value as number;
}

function itemId(value: unknown, field: string) {
  if (typeof value !== "string" || !value || value.length > MAX_ID) throw new AgentToolError(`${field} must be an item ID from search_items.`);
  return value;
}

export function parseSearchItemsArgs(args: Record<string, unknown>): SearchItemsArgs {
  if (typeof args.query !== "string") throw new AgentToolError("query must be a string.");
  if (args.query.length > MAX_QUERY) throw new AgentToolError(`query must be at most ${MAX_QUERY} characters.`);
  if (args.type !== undefined && !AGENT_ITEM_TYPES.some((type) => type === args.type)) {
    throw new AgentToolError(`type must be one of ${AGENT_ITEM_TYPES.join(", ")}.`);
  }
  if (args.has_images !== undefined && typeof args.has_images !== "boolean") throw new AgentToolError("has_images must be true or false.");
  return {
    query: args.query,
    type: args.type as Item["type"] | undefined,
    collection: optionalName(args.collection, "collection"),
    tag: optionalName(args.tag, "tag"),
    hasImages: args.has_images as boolean | undefined,
    limit: integer(args.limit, "limit", 1, MAX_LIMIT, DEFAULT_LIMIT),
  };
}

export function parseGetItemArgs(args: Record<string, unknown>): GetItemArgs {
  return {
    id: itemId(args.id, "id"),
    imageOffset: integer(args.image_offset, "image_offset", 0, 1000, 0),
    maxImages: integer(args.max_images, "max_images", 0, MAX_ITEM_IMAGES, 4),
  };
}

export function parseViewImagesArgs(args: Record<string, unknown>): ViewImagesArgs {
  if (!Array.isArray(args.ids) || !args.ids.length || args.ids.length > MAX_VIEW_ITEMS) {
    throw new AgentToolError(`ids must list 1 to ${MAX_VIEW_ITEMS} item IDs from search_items.`);
  }
  return { ids: [...new Set(args.ids.map((id) => itemId(id, "ids")))] };
}

export function parseNoArgs(args: Record<string, unknown>) {
  if (!isObject(args)) throw new AgentToolError("Arguments must be an object.");
}

/** Every picture an item holds, best first. Links lead with their card cover. */
export function itemImageRefs(item: Item): AgentImageRef[] {
  switch (item.type) {
    case "image":
      return item.assetIds.map((id, index) => ({ source: "asset", id, label: item.assetIds.length > 1 ? `Image ${index + 1} of ${item.assetIds.length}` : "Image" }));
    case "link": {
      const refs: AgentImageRef[] = [];
      const seen = new Set<string>();
      const add = (id: string | null | undefined, label: string) => {
        if (!id || seen.has(id)) return;
        seen.add(id);
        refs.push({ source: "asset", id, label });
      };
      add(linkCoverAssetId(item), "Cover");
      add(item.previewAssetId, "Page preview");
      linkScreenshots(item).forEach((shot, index) => add(shot.assetId, `Screenshot ${index + 1}`));
      return refs;
    }
    case "video":
      return [{ source: "video-poster", id: item.assetId, label: "Video frame" }];
    case "document":
      return item.format === "pdf" ? [{ source: "pdf-page", id: item.assetId, label: "First page" }] : [];
    default:
      return [];
  }
}

function bounded(text: string | undefined): AgentText | undefined {
  const value = text?.trim();
  if (!value) return undefined;
  return value.length > MAX_TEXT_CHARACTERS ? { text: value.slice(0, MAX_TEXT_CHARACTERS), truncated: true } : { text: value };
}

type Names = { tags: ReadonlyMap<string, string>; collections: ReadonlyMap<string, string> };

export function nameIndex(tags: readonly Tag[], collections: readonly Collection[]): Names {
  return {
    tags: new Map(tags.map((tag) => [tag.id, tag.name])),
    collections: new Map(collections.map((collection) => [collection.id, collection.name])),
  };
}

function summary(item: Item, names: Names, appOrigin: string) {
  const collection = item.collectionIds[0] ? names.collections.get(item.collectionIds[0]) : undefined;
  return {
    id: item.id,
    type: item.type,
    title: itemListTitle(item),
    ...(item.type === "link" ? { url: item.url } : {}),
    tags: item.tagIds.flatMap((id) => names.tags.get(id) ?? []),
    ...(collection ? { collection } : {}),
    images: itemImageRefs(item).length,
    openInKeepall: new URL(`/items/${encodeURIComponent(item.id)}`, appOrigin).href,
    savedAt: new Date(item.createdAt).toISOString(),
  };
}

function sameName(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0;
}

/** Narrows by type, collection, tag, and pictures. Unknown collection or tag names are an error, not an empty result. */
function searchFilter(tags: readonly Tag[], collections: readonly Collection[], args: SearchItemsArgs) {
  const collectionIds = args.collection ? new Set(collections.filter((collection) => sameName(collection.name, args.collection!)).map((collection) => collection.id)) : null;
  const tagIds = args.tag ? new Set(tags.filter((tag) => sameName(tag.name, args.tag!)).map((tag) => tag.id)) : null;
  if (collectionIds && !collectionIds.size) throw new AgentToolError(`No collection is named "${args.collection}". Use list_collections to see the names.`);
  if (tagIds && !tagIds.size) throw new AgentToolError(`No tag is named "${args.tag}". Use list_tags to see the names.`);
  return (item: Item) => (!args.type || item.type === args.type) &&
    (!collectionIds || item.collectionIds.some((id) => collectionIds.has(id))) &&
    (!tagIds || item.tagIds.some((id) => tagIds.has(id))) &&
    (args.hasImages === undefined || (itemImageRefs(item).length > 0) === args.hasImages);
}

/** The library's own search rules, best match first and newest first among ties. Expects items without Trash. */
export function searchItemsForAgent(items: readonly Item[], tags: readonly Tag[], collections: readonly Collection[], args: SearchItemsArgs, appOrigin: string) {
  const names = nameIndex(tags, collections);
  const included = searchFilter(tags, collections, args);
  const terms = parseSearchTerms(args.query);
  const matches: Array<{ item: Item; tagNames: string[]; score: number }> = [];
  for (const item of items) {
    if (!included(item)) continue;
    const tagNames = item.tagIds.flatMap((id) => names.tags.get(id) ?? []);
    const score = searchRelevanceScore(item, terms, tagNames);
    if (score !== null) matches.push({ item, tagNames, score });
  }
  matches.sort((left, right) => right.score - left.score || right.item.createdAt - left.item.createdAt);
  return {
    total: matches.length,
    items: matches.slice(0, args.limit).map(({ item, tagNames }): AgentSearchResult => {
      const excerpt = terms.length ? findSearchExcerpt(item, args.query, tagNames) : undefined;
      return { ...summary(item, names, appOrigin), ...(excerpt ? { excerpt: `${excerpt.label}: ${excerpt.text}` } : {}) };
    }),
  };
}

/** Everything the agent can read about one item, with long text bounded. Images travel separately. */
export function describeItemForAgent(item: Item, names: Names, appOrigin: string, documentText?: string): AgentItemDetail {
  const base = { ...summary(item, names, appOrigin), updatedAt: new Date(item.updatedAt).toISOString() };
  switch (item.type) {
    case "note":
      return { ...base, note: bounded(item.content), format: item.format ?? "plain" };
    case "image": {
      const text = item.analysis?.map((entry) => entry.ocr?.text.trim() ?? "").filter(Boolean).join("\n\n");
      const palette = [...new Set(item.analysis?.flatMap((entry) => entry.palette ?? []) ?? [])];
      return {
        ...base, caption: bounded(item.caption), sourceUrl: item.sourceUrl || undefined, imageText: bounded(text),
        ...(palette.length ? { palette } : {}),
      };
    }
    case "link":
      return {
        ...base, note: bounded(item.noteContent),
        ...(item.previewTitle || item.previewDescription ? { preview: { title: item.previewTitle, description: item.previewDescription } } : {}),
        ...(item.article ? {
          article: {
            title: item.article.title, author: item.article.author, siteName: item.article.siteName, sourceUrl: item.article.sourceUrl,
            text: bounded(item.article.text) ?? { text: "" },
          },
        } : {}),
      };
    case "video":
      return { ...base, note: bounded(item.noteContent), fileName: item.sourceFileName };
    case "document":
      return { ...base, note: bounded(item.noteContent), fileName: item.sourceFileName, format: item.format, document: bounded(documentText) };
  }
}

export function listCollectionsForAgent(items: readonly Item[], collections: readonly Collection[]) {
  const counts = new Map<string, number>();
  for (const item of items) for (const id of item.collectionIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return {
    collections: collections.map((collection) => ({ name: collection.name, items: counts.get(collection.id) ?? 0 }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    unsorted: items.filter((item) => !item.collectionIds.length).length,
  };
}

export function listTagsForAgent(items: readonly Item[], tags: readonly Tag[]) {
  const counts = new Map<string, number>();
  for (const item of items) for (const id of item.tagIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return { tags: tags.map((tag) => ({ name: tag.name, items: counts.get(tag.id) ?? 0 })).sort((left, right) => left.name.localeCompare(right.name)) };
}
