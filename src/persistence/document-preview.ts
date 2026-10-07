import type { DocumentAsset } from "@/domain/document";
import { getDb } from "./db";
import { getDocumentRevision } from "./documents";

/** Bounded text samples; the cache keeps strings, never original files. */
export function createDocumentPreviewReader(
  read: (assetId: string) => Promise<DocumentAsset | undefined> = id => getDb().documentAssets.get(id),
  limit = 64,
) {
  const cache = new Map<string, Promise<string | null>>();
  return (assetId: string, revision: string): Promise<string | null> => {
    const key = `${revision}:${assetId}`;
    const cached = cache.get(key);
    if (cached) { cache.delete(key); cache.set(key, cached); return cached; }
    const pending = read(assetId).then(original => {
      if (!original) { if (cache.get(key) === pending) cache.delete(key); return null; }
      const text = new TextDecoder("utf-8", { fatal: true }).decode(original.bytes.subarray(0, 8192), { stream: true });
      return text.trim().slice(0, 1400);
    }).catch(error => { if (cache.get(key) === pending) cache.delete(key); throw error; });
    cache.set(key, pending);
    while (cache.size > limit) cache.delete(cache.keys().next().value!);
    return pending;
  };
}

const readPreview = createDocumentPreviewReader();

export async function getDocumentPreview(assetId: string) {
  return readPreview(assetId, await getDocumentRevision());
}
