import type { Item } from "./item";

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export type SearchRange = { start: number; end: number };
type SearchField = {
  field: "title" | "content" | "noteContent" | "caption" | "previewTitle" | "previewDescription" | "url" | "sourceUrl" | "sourceFileName" | "tag";
  label: string;
  text: string;
};
export type SearchMatch = SearchField & { ranges: SearchRange[] };

/** Personal content comes first when choosing a result's explanatory excerpt. */
function searchableFields(item: Item, tagNames: readonly string[]): SearchField[] {
  let fields: SearchField[];
  switch (item.type) {
    case "note":
      fields = [{ field: "content", label: "Note", text: item.content }];
      break;
    case "image":
      fields = [
        { field: "caption", label: "Caption", text: item.caption },
        { field: "sourceUrl", label: "Source", text: item.sourceUrl },
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
export function findTextMatches(text: string, query: string): SearchRange[] {
  const needle = normalizeSearchQuery(query);
  if (!needle) return [];
  const lower = text.toLowerCase();
  // Unicode lowercase expansion (for example İ → i̇) must not shift highlights.
  let offsets: SearchRange[] | undefined;
  if (lower.length !== text.length) {
    offsets = [];
    let start = 0;
    for (const char of text) {
      for (let index = 0; index < char.toLowerCase().length; index++) offsets.push({ start, end: start + char.length });
      start += char.length;
    }
  }
  const ranges: SearchRange[] = [];
  let index = lower.indexOf(needle);
  while (index !== -1) {
    ranges.push({ start: offsets?.[index].start ?? index, end: offsets?.[index + needle.length - 1].end ?? index + needle.length });
    index = lower.indexOf(needle, index + needle.length);
  }
  return ranges;
}

export function findSearchMatches(item: Item, query: string, tagNames: readonly string[] = []): SearchMatch[] {
  if (!normalizeSearchQuery(query)) return [];
  return searchableFields(item, tagNames).flatMap(field => {
    const ranges = findTextMatches(field.text, query);
    return ranges.length ? [{ ...field, ranges }] : [];
  });
}

export function createSearchExcerpt(text: string, query: string): string {
  const match = findTextMatches(text, query)[0];
  if (!match) return "";
  const length = Math.max(160, match.end - match.start);
  const start = Math.max(0, match.start - 40);
  const end = Math.min(text.length, Math.max(start + length, match.end));
  return `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

/** Case-insensitive substring match, without allocating ranges for the whole library. */
export function matchesSearchQuery(item: Item, query: string, tagNames: readonly string[] = []): boolean {
  const needle = normalizeSearchQuery(query);
  return !needle || searchableFields(item, tagNames).some(({ text }) => text.toLowerCase().includes(needle));
}
