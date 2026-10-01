/** Shared pause flag so enrich can skip ITEMS_CHANGED without importing the coordinator. */

let paused = false;
const listeners = new Set<() => void>();

export function isPreviewEnrichPaused(): boolean {
  return paused;
}

export function setPreviewEnrichPaused(value: boolean): void {
  if (paused === value) return;
  paused = value;
  for (const listener of listeners) listener();
}

export function subscribePreviewEnrichPause(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
