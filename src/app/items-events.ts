export const ITEMS_CHANGED_EVENT = "keepall:items-changed";

export type ItemsChangedDetail = {
  /** Background preview enrich — safe to defer reload while browsing. */
  source?: "enrich";
  /** Enriched row — library can patch one item instead of listItems(). */
  itemId?: string;
};

export function dispatchEnrichItemsChanged(itemId: string): void {
  window.dispatchEvent(
    new CustomEvent<ItemsChangedDetail>(ITEMS_CHANGED_EVENT, {
      detail: { source: "enrich", itemId },
    }),
  );
}

export function isEnrichItemsChanged(event: Event): boolean {
  const detail = (event as CustomEvent<ItemsChangedDetail>).detail;
  return detail?.source === "enrich";
}

export function enrichChangedItemId(event: Event): string | null {
  const detail = (event as CustomEvent<ItemsChangedDetail>).detail;
  if (detail?.source !== "enrich" || typeof detail.itemId !== "string") {
    return null;
  }
  return detail.itemId;
}

export const PREVIEW_WELCOME_EVENT = "keepall:preview-welcome";

export type PreviewWelcomeDetail = {
  linkIds: string[];
};

export function dispatchPreviewWelcome(linkIds: string[]) {
  if (linkIds.length === 0) {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<PreviewWelcomeDetail>(PREVIEW_WELCOME_EVENT, {
      detail: { linkIds },
    }),
  );
}
