import { decodeTextDocument, type DocumentAsset, type DocumentItem } from "@/domain/document";
import { findSearchExcerpt, parseSearchTerms, searchRelevanceScore, type DocumentSearchMatch } from "@/domain/search";
import { getDb } from "./db";
import { readPdfText } from "./pdf-document";

export type DocumentSearchRequest = {
  id: number;
  query: string;
  entries: { item: DocumentItem; tagNames: string[] }[];
};
export type DocumentSearchResponse = {
  id: number;
  query: string;
  matches: [string, DocumentSearchMatch][];
  unavailable: number;
};

/** Worker-local, disposable cache. Originals remain the source of truth. */
export function createDocumentSearcher(
  readOriginal: (id: string) => Promise<DocumentAsset | undefined> = id => getDb().documentAssets.get(id),
  cacheBytes = 32 * 1024 * 1024,
) {
  const cache = new Map<string, string>();
  let usedBytes = 0;

  async function textFor(item: DocumentItem) {
    const key = `${item.format === "pdf" ? "pdf" : "text"}:${item.assetId}`;
    const cached = cache.get(key);
    if (cached !== undefined) {
      cache.delete(key);
      cache.set(key, cached);
      return cached;
    }
    const original = await readOriginal(item.assetId);
    if (!original) throw new Error("Missing document original");
    // A newer query may have populated this original while the read was pending.
    const shared = cache.get(key);
    if (shared !== undefined) return shared;
    const text = item.format === "pdf" ? original.pdfText ?? await readPdfText(original.bytes) : decodeTextDocument(original.bytes);
    const size = text.length * 2;
    if (size <= cacheBytes) {
      while (usedBytes + size > cacheBytes && cache.size) {
        const oldest = cache.keys().next().value!;
        usedBytes -= cache.get(oldest)!.length * 2;
        cache.delete(oldest);
      }
      cache.set(key, text);
      usedBytes += size;
    }
    return text;
  }

  return async (request: DocumentSearchRequest, isCurrent = () => true): Promise<DocumentSearchResponse | null> => {
    const terms = parseSearchTerms(request.query);
    const response: DocumentSearchResponse = { id: request.id, query: request.query, matches: [], unavailable: 0 };
    if (!terms.length) return response;
    for (let index = 0; index < request.entries.length; index++) {
      if (!isCurrent()) return null;
      const { item, tagNames } = request.entries[index];
      let text = "";
      try { text = await textFor(item); }
      catch { response.unavailable++; }
      if (!isCurrent()) return null;
      const score = searchRelevanceScore(item, terms, tagNames, text);
      if (score !== null) response.matches.push([item.id, { score, excerpt: findSearchExcerpt(item, request.query, tagNames, text) }]);
      // Let new worker messages cancel a long scan, including scans served entirely from cache.
      if ((index + 1) % 16 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    return isCurrent() ? response : null;
  };
}
