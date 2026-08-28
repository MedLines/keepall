/** Shared pause flag so enrich can skip ITEMS_CHANGED without importing the coordinator. */

let paused = false;

export function isPreviewEnrichPaused(): boolean {
  return paused;
}

export function setPreviewEnrichPaused(value: boolean): void {
  paused = value;
}
