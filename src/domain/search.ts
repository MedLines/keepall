import type { Item } from "./item";
import { matchesPaletteColor } from "./image-analysis";

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** An unfinished quote keeps its phrase together while the user types. */
export function parseSearchTerms(query: string): string[] {
  const terms = Array.from(query.matchAll(/"([^"]*)"|"([^"]*)$|([^\s"]+)/g),
    match => normalizeSearchQuery(match[1] ?? match[2] ?? match[3])).filter(Boolean);
  return [...new Set(terms)];
}

export type SearchRange = { start: number; end: number };
type SearchField = {
  field: "title" | "content" | "noteContent" | "caption" | "previewTitle" | "previewDescription" | "url" | "sourceUrl" | "sourceFileName" | "tag";
  label: string;
  text: string;
};
export type SearchMatch = SearchField & { ranges: SearchRange[] };
export type SearchExcerpt = { label: string; text: string };
export type DocumentSearchMatch = { score: number; excerpt?: SearchExcerpt };

const SEARCH_FIELD_WEIGHTS: Record<SearchField["field"], number> = {
  title: 8,
  content: 4,
  noteContent: 4,
  caption: 4,
  tag: 4,
  previewTitle: 2,
  previewDescription: 2,
  url: 1,
  sourceUrl: 1,
  sourceFileName: 1,
};

/** Personal content comes first when choosing a result's explanatory excerpt. */
function searchableFields(item: Item, tagNames: readonly string[], documentText = ""): SearchField[] {
  let fields: SearchField[];
  switch (item.type) {
    case "note":
      fields = [{ field: "content", label: "Note", text: item.content }];
      break;
    case "image":
      fields = [
        { field: "caption", label: "Caption", text: item.caption },
        { field: "content", label: "Image text", text: item.analysis?.map(entry => entry.ocr?.text ?? "").join("\n") ?? "" },
        { field: "sourceUrl", label: "Source", text: item.sourceUrl },
      ];
      break;
    case "document":
      fields = [
        { field: "noteContent", label: "My note", text: item.noteContent },
        { field: "content", label: "File contents", text: documentText },
        { field: "sourceFileName", label: "Filename", text: item.sourceFileName },
      ];
      break;
    case "video":
      fields = [
        { field: "noteContent", label: "My note", text: item.noteContent ?? "" },
        { field: "sourceFileName", label: "Filename", text: item.sourceFileName },
      ];
      break;
    case "link":
      fields = [
        { field: "noteContent", label: "My note", text: item.noteContent ?? "" },
        { field: "previewTitle", label: "Preview title", text: item.previewTitle },
        { field: "previewDescription", label: "Preview", text: item.previewDescription },
        { field: "url", label: "Source", text: item.url },
      ];
  }
  return [...fields, ...tagNames.map(text => ({ field: "tag" as const, label: "Tag", text })), { field: "title", label: "Title", text: item.title }];
}

/** Literal, non-overlapping matches with offsets into the original text. */
export function findTextMatches(text: string, query: string, limit = Infinity): SearchRange[] {
  const needle = normalizeSearchQuery(query);
  if (!needle) return [];
  const lower = text.toLowerCase();
  const ranges: SearchRange[] = [];
  let index = lower.indexOf(needle);
  // Walk expanded Unicode offsets once, without allocating an entry for every character.
  const characters = text[Symbol.iterator]();
  let sourceOffset = 0, lowerOffset = 0, character = characters.next();
  const originalOffset = (offset: number, end: boolean) => {
    while (!character.done) {
      const length = character.value.toLowerCase().length;
      if (offset < lowerOffset + length) return sourceOffset + (end ? character.value.length : 0);
      sourceOffset += character.value.length;
      lowerOffset += length;
      character = characters.next();
    }
    return text.length;
  };
  while (index !== -1) {
    ranges.push(lower.length === text.length ? { start: index, end: index + needle.length }
      : { start: originalOffset(index, false), end: originalOffset(index + needle.length - 1, true) });
    if (ranges.length >= limit) break;
    index = lower.indexOf(needle, index + needle.length);
  }
  return ranges;
}

export function findQueryTextMatches(text: string, query: string): SearchRange[] {
  const matches = parseSearchTerms(query).flatMap(term => findTextMatches(text, term))
    .sort((left, right) => left.start - right.start || right.end - left.end);
  const ranges: SearchRange[] = [];
  for (const match of matches) {
    const previous = ranges[ranges.length - 1];
    if (previous && match.start < previous.end) {
      previous.end = Math.max(previous.end, match.end);
    } else {
      ranges.push({ ...match });
    }
  }
  return ranges;
}

export function findSearchMatches(item: Item, query: string, tagNames: readonly string[] = []): SearchMatch[] {
  if (!normalizeSearchQuery(query)) return [];
  return searchableFields(item, tagNames).flatMap(field => {
    const ranges = findQueryTextMatches(field.text, query);
    return ranges.length ? [{ ...field, ranges }] : [];
  });
}

export function createSearchExcerpt(text: string, query: string): string {
  const match = parseSearchTerms(query).flatMap(term => findTextMatches(text, term, 1))
    .sort((left, right) => left.start - right.start || right.end - left.end)[0];
  if (!match) return "";
  const length = Math.max(160, match.end - match.start);
  const start = Math.max(0, match.start - 40);
  const end = Math.min(text.length, Math.max(start + length, match.end));
  return `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

export function findSearchExcerpt(item: Item, query: string, tagNames: readonly string[] = [], documentText = ""): SearchExcerpt | undefined {
  for (const field of searchableFields(item, tagNames, documentText)) {
    const text = createSearchExcerpt(field.text, query);
    if (text) return { label: field.label, text };
  }
}

/** Null means a missing term; otherwise each term contributes its strongest field match. */
export function searchRelevanceScore(item: Item, terms: readonly string[], tagNames: readonly string[] = [], documentText = ""): number | null {
  if (!terms.length) return 0;
  const fields = searchableFields(item, tagNames, documentText).map(field => ({ ...field, text: field.text.toLowerCase() }));
  let score = 0;
  for (const term of terms) {
    if (term.startsWith("color:")) {
      if (item.type !== "image" || !matchesPaletteColor(item.analysis?.flatMap(entry => entry.palette ?? []) ?? [], term.slice(6))) return null;
      score += 4;
      continue;
    }
    let best = 0;
    for (const field of fields) {
      if (!field.text.includes(term)) continue;
      best = Math.max(best, SEARCH_FIELD_WEIGHTS[field.field]);
    }
    if (!best) return null;
    score += best;
  }
  if (normalizeSearchQuery(item.title) === terms.join(" ")) score += 8;
  return score;
}

export function matchesSearchQuery(item: Item, query: string, tagNames: readonly string[] = [], documentText = ""): boolean {
  return searchRelevanceScore(item, parseSearchTerms(query), tagNames, documentText) !== null;
}
