import { itemListTitle, type Item } from "./item";
import type { ImageItem } from "./image";
import type { LinkItem } from "./link";
import type { NoteItem } from "./note";
import { noteReadingBody } from "./note";

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

/** Hostname for a link card's secondary line. Falls back to the raw URL. */
export function linkCardHost(link: LinkItem): string {
  try {
    return new URL(link.url).hostname;
  } catch {
    return link.url;
  }
}

/**
 * Favicon image URL from the link hostname — loaded by the browser, not Keepall
 * server. Used when no local/OG preview exists yet (e.g. after import).
 */
export function linkFaviconUrl(
  linkUrl: string,
  options?: { size?: number },
): string | null {
  try {
    const hostname = new URL(linkUrl.trim()).hostname;
    if (!hostname) {
      return null;
    }
    const size = options?.size ?? 128;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=${size}`;
  } catch {
    return null;
  }
}

/** Short plain-text preview of note content for the secondary line. */
export function noteCardText(note: Pick<NoteItem, "content" | "format">): string {
  if (note.format !== "markdown") return note.content.trim();

  return note.content
    .replace(/```[\s\S]*?```/g, " Code example ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s*)?/gm, "")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** One short block for the card; the item page owns the complete note. */
export function noteCardExcerpt(note: NoteItem): string {
  const blocks = noteReadingBody(note).trim().split(/\n\s*\n/).filter(Boolean);
  const firstBody = blocks.find((block) => !/^\s{0,3}#{1,6}\s/.test(block)) ?? "";
  const text = noteCardText({ ...note, content: firstBody }).replace(/\s+/g, " ");
  if (text.length <= 145) return text;
  const cutoff = text.slice(0, 144).lastIndexOf(" ");
  return `${text.slice(0, cutoff > 100 ? cutoff : 144).trimEnd()}…`;
}

export function noteCardSnippet(
  note: NoteItem,
  maxLength = NOTE_SNIPPET_MAX_LENGTH,
): string {
  const text = noteCardText(note).replace(/\s+/g, " ");
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}…`;
}

/** Secondary line for image cards: caption, else source host, else empty. */
export function imageCardSecondary(image: ImageItem): string {
  if (image.caption) {
    return noteCardText({ content: image.caption, format: image.captionFormat });
  }
  if (image.sourceUrl) {
    try {
      return new URL(image.sourceUrl).hostname;
    } catch {
      return image.sourceUrl;
    }
  }
  return "";
}

/** Secondary line under the type chip. */
export function cardSecondaryLine(item: Item): string {
  if (item.type === "note") {
    return noteCardSnippet(item);
  }
  if (item.type === "image") {
    return imageCardSecondary(item);
  }
  return linkCardHost(item);
}
