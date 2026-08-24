import { itemListTitle, type Item } from "./item";
import type { LinkItem } from "./link";
import type { NoteItem } from "./note";

/** Default max length for the note secondary line on a library card. */
export const NOTE_SNIPPET_MAX_LENGTH = 80;

/**
 * First letter for the card placeholder block.
 * Uses the same title string the card shows (including link hostname / Untitled).
 */
export function cardInitial(item: Item): string {
  const title = itemListTitle(item).trim();
  if (!title) {
    return "?";
  }

  const letter = title[0];
  return letter.toLocaleUpperCase();
}

/** Hostname for a link card’s secondary line. Falls back to the raw URL. */
export function linkCardHost(link: LinkItem): string {
  try {
    return new URL(link.url).hostname;
  } catch {
    return link.url;
  }
}

/** Short plain-text preview of note content for the secondary line. */
export function noteCardSnippet(
  note: NoteItem,
  maxLength = NOTE_SNIPPET_MAX_LENGTH,
): string {
  const text = note.content.trim().replace(/\s+/g, " ");
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}…`;
}

/** Secondary line under the type chip: host for links, snippet for notes. */
export function cardSecondaryLine(item: Item): string {
  if (item.type === "note") {
    return noteCardSnippet(item);
  }

  return linkCardHost(item);
}
