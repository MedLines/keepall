/** Local binary stored in IndexedDB (thin assets table). */
export type Asset = {
  id: string;
  mimeType: string;
  byteLength: number;
  /** Raw image bytes (Uint8Array survives IndexedDB better than Blob). */
  bytes: Uint8Array;
  /** SHA-256 hex of bytes; used to reuse the same file. Empty on older rows until backfilled. */
  contentHash: string;
  createdAt: number;
};

export type CreateAssetInput = {
  mimeType: string;
  bytes: Uint8Array;
  contentHash?: string;
};

/** SHA-256 hex digest of image bytes (same file → same string). */
export async function hashAssetBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice());
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

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
    contentHash: input.contentHash ?? "",
    createdAt: now,
  };
}

export function coerceAssetFields(
  raw: Partial<Asset> | null | undefined,
): Pick<Asset, "contentHash"> {
  return {
    contentHash:
      typeof raw?.contentHash === "string" ? raw.contentHash : "",
  };
}

export function assetToBlob(asset: Asset): Blob {
  // Copy into a plain ArrayBuffer. Some IndexedDB drivers return shared views.
  const copy = new Uint8Array(asset.bytes);
  return new Blob([copy], { type: asset.mimeType });
}

/** True when two hash lists are the same multiset (order ignored). */
export function sameContentHashMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const counts = new Map<string, number>();
  for (const hash of a) {
    if (!hash) {
      return false;
    }
    counts.set(hash, (counts.get(hash) ?? 0) + 1);
  }
  for (const hash of b) {
    if (!hash) {
      return false;
    }
    const next = (counts.get(hash) ?? 0) - 1;
    if (next < 0) {
      return false;
    }
    counts.set(hash, next);
  }
  return true;
}
