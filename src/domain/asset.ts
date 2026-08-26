/** Local binary stored in IndexedDB (thin assets table). */
export type Asset = {
  id: string;
  mimeType: string;
  byteLength: number;
  /** Raw image bytes (Uint8Array survives IndexedDB better than Blob). */
  bytes: Uint8Array;
  createdAt: number;
};

export type CreateAssetInput = {
  mimeType: string;
  bytes: Uint8Array;
};

export function buildAsset(
  input: CreateAssetInput,
  options?: { id?: string; now?: number },
): Asset {
  const mimeType = input.mimeType.trim() || "application/octet-stream";
  const now = options?.now ?? Date.now();
  const bytes = input.bytes;

  return {
    id: options?.id ?? crypto.randomUUID(),
    mimeType,
    byteLength: bytes.byteLength,
    bytes,
    createdAt: now,
  };
}

export function assetToBlob(asset: Asset): Blob {
  // Copy into a plain ArrayBuffer. Some IndexedDB drivers return shared views.
  const copy = new Uint8Array(asset.bytes);
  return new Blob([copy], { type: asset.mimeType });
}
