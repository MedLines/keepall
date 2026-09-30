import { noteCardText } from "./card-display";
import type { Item } from "./item";
import { parseNoteImageLine } from "./note";

const LABEL_LENGTH = 64;
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function firstLine(text: string): string {
  return text.split(/[\r\n\u2028\u2029]/).find((line) => line.trim())?.trim() ?? "";
}

function contentLabel(content: string, format?: "markdown"): string {
  const line = content.split(/[\r\n\u2028\u2029]/).find((line) => line.trim() && !parseNoteImageLine(line))?.trim() ?? "";
  if (format !== "markdown") return line;
  if (/^(?:```|~~~)|^(?:[-*_]\s*){3,}$|^#{1,6}$/.test(line)) return "";
  return noteCardText({
    content: line.replace(/^(?:>\s*)+/, "").replace(/\s+#+\s*$/, ""),
    format,
  });
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return firstLine(url);
  }
}

/** A bounded item reference for actions, independent of the complete reading title. */
export function itemActionLabel(item: Item): string {
  let label = firstLine(item.title);
  if (!label) {
    switch (item.type) {
      case "note":
        label = contentLabel(item.content, item.format) || "Untitled note";
        break;
      case "image":
        label = contentLabel(item.caption, item.captionFormat) || hostLabel(item.sourceUrl) || "Image";
        break;
      case "link":
        label = firstLine(item.previewTitle) || hostLabel(item.url) || "Link";
        break;
      case "video":
        label = "Video";
        break;
    }
  }
  label = label.replace(/\s+/g, " ");
  const characters: string[] = [];
  for (const { segment } of graphemes.segment(label)) {
    if (characters.length === LABEL_LENGTH) {
      const prefix = characters.slice(0, LABEL_LENGTH - 1).join("");
      const boundary = characters.slice(0, LABEL_LENGTH - 1).lastIndexOf(" ");
      return `${(boundary > 40 ? characters.slice(0, boundary).join("") : prefix).trimEnd()}…`;
    }
    characters.push(segment);
  }
  return label;
}
