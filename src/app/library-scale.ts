import type { Item } from "@/domain/item";

/** Keep small libraries mounted; window larger libraries for folder navigation. */
export const LIBRARY_VIRTUALIZE_MIN = 60;

export const LIBRARY_GRID_MIN_COL_PX = 320;
export const LIBRARY_GRID_GAP_PX = 20;
export const LIBRARY_LIST_ROW_ESTIMATE_PX = 112;
export const LIBRARY_GRID_ROW_ESTIMATE_PX = 320;

export function gridColumnCount(containerWidth: number): number {
  return Math.max(1, Math.floor(
    (containerWidth + LIBRARY_GRID_GAP_PX) /
    (LIBRARY_GRID_MIN_COL_PX + LIBRARY_GRID_GAP_PX),
  ));
}

function estimatedLines(text: string, columnWidth: number, maximum: number): number {
  const contentWidth = Math.max(200, columnWidth - 64);
  const charactersPerLine = Math.max(20, Math.floor(contentWidth / 8));
  return Math.min(maximum, Math.max(1, Math.ceil(text.trim().length / charactersPerLine)));
}

/**
 * First-paint height before the browser measures a masonry card.
 * Estimates follow the visible card shape so collection switches begin close
 * to their final positions instead of treating every card as a 320px block.
 */
export function estimateLibraryGridItemHeight(
  item: Item,
  columnWidth: number,
): number {
  const width = Math.max(LIBRARY_GRID_MIN_COL_PX, columnWidth);

  if (item.type === "note") {
    const title = item.title.trim() || "Untitled";
    const titleLines = estimatedLines(title, width, 2);
    const contentLines = estimatedLines(item.content, width, 6);
    return 92 + titleLines * 32 + contentLines * 26;
  }

  if (item.type === "link") {
    const mediaHeight = item.previewAssetId ? width / 1.6 : 0;
    const title = item.title.trim() || item.previewTitle.trim() || item.url;
    const descriptionLines = item.previewDescription.trim()
      ? estimatedLines(item.previewDescription, width, 2)
      : 0;
    return mediaHeight + 100 + estimatedLines(title, width, 2) * 24 + descriptionLines * 20;
  }

  const hasFooter = item.type === "video"
    ? Boolean(item.title.trim())
    : Boolean(item.title.trim() || item.caption.trim() || item.sourceUrl);
  return width / 1.25 + (hasFooter ? 76 : 16);
}
