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
