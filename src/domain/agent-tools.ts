import type { Collection } from "./collection";
import { itemListTitle, type Item } from "./item";
import { findSearchExcerpt, parseSearchTerms, searchRelevanceScore } from "./search";
import type { Tag } from "./tag";

export const AGENT_ITEM_TYPES = ["link", "note", "image", "video", "document"] as const;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_QUERY = 500;

export type SearchItemsArgs = { query: string; type?: Item["type"]; limit: number };

export type AgentSearchResult = {
  id: string;
  type: Item["type"];
  title: string;
  url?: string;
  excerpt?: string;
  tags: string[];
  collection?: string;
  openInKeepall: string;
  savedAt: string;
};

export class AgentToolError extends Error {}

export function parseSearchItemsArgs(args: Record<string, unknown>): SearchItemsArgs {
  if (typeof args.query !== "string") throw new AgentToolError("query must be a string.");
  if (args.query.length > MAX_QUERY) throw new AgentToolError(`query must be at most ${MAX_QUERY} characters.`);
  if (args.type !== undefined && !AGENT_ITEM_TYPES.some((type) => type === args.type)) {
    throw new AgentToolError(`type must be one of ${AGENT_ITEM_TYPES.join(", ")}.`);
  }
  if (args.limit !== undefined && (!Number.isInteger(args.limit) || (args.limit as number) < 1 || (args.limit as number) > MAX_LIMIT)) {
    throw new AgentToolError(`limit must be a whole number from 1 to ${MAX_LIMIT}.`);
  }
  return { query: args.query, type: args.type as Item["type"] | undefined, limit: (args.limit as number | undefined) ?? DEFAULT_LIMIT };
}

/** The library's own search rules, best match first and newest first among ties. Expects items without Trash. */
export function searchItemsForAgent(items: readonly Item[], tags: readonly Tag[], collections: readonly Collection[], args: SearchItemsArgs, appOrigin: string) {
  const tagNames = new Map(tags.map((tag) => [tag.id, tag.name]));
  const collectionNames = new Map(collections.map((collection) => [collection.id, collection.name]));
  const terms = parseSearchTerms(args.query);
  const matches: Array<{ item: Item; names: string[]; score: number }> = [];
  for (const item of items) {
    if (args.type && item.type !== args.type) continue;
    const names = item.tagIds.flatMap((id) => tagNames.get(id) ?? []);
    const score = searchRelevanceScore(item, terms, names);
    if (score !== null) matches.push({ item, names, score });
  }
  matches.sort((left, right) => right.score - left.score || right.item.createdAt - left.item.createdAt);
  return {
    total: matches.length,
    items: matches.slice(0, args.limit).map(({ item, names }): AgentSearchResult => {
      const collection = item.collectionIds[0] ? collectionNames.get(item.collectionIds[0]) : undefined;
      const excerpt = terms.length ? findSearchExcerpt(item, args.query, names) : undefined;
      return {
        id: item.id,
        type: item.type,
        title: itemListTitle(item),
        ...(item.type === "link" ? { url: item.url } : {}),
        ...(excerpt ? { excerpt: `${excerpt.label}: ${excerpt.text}` } : {}),
        tags: names,
        ...(collection ? { collection } : {}),
        openInKeepall: new URL(`/items/${encodeURIComponent(item.id)}`, appOrigin).href,
        savedAt: new Date(item.createdAt).toISOString(),
      };
    }),
  };
}
