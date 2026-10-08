export const OPEN_CAPTURE_EVENT = "keepall:open-capture";

let captureCollectionName: string | null = null;

export function setCaptureCollectionName(name: string | null): void {
  captureCollectionName = name;
}

export function getCaptureCollectionName(): string | null {
  return captureCollectionName;
}

export function openCaptureDialog(): void {
  window.dispatchEvent(new CustomEvent(OPEN_CAPTURE_EVENT));
}

export function openBulkImportDialog(): void {
  window.dispatchEvent(new CustomEvent(OPEN_CAPTURE_EVENT, { detail: { bulkImport: true } }));
}

const consumedBulkIntents = new Set<string>();

/** Consume only the extension's intent hash, preserving the route, query and history state. */
export function consumeBulkImportIntent(): boolean {
  const match = /^#keepall-bulk-import=([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(window.location.hash);
  if (!match || window.location.pathname !== "/") return false;
  window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  if (consumedBulkIntents.has(match[1])) return false;
  consumedBulkIntents.add(match[1]);
  if (consumedBulkIntents.size > 64) consumedBulkIntents.delete(consumedBulkIntents.values().next().value!);
  return true;
}
