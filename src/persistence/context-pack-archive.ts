import { BlobReader, BlobWriter, TextReader, Uint8ArrayReader, ZipWriter } from "@zip.js/zip.js";
import { articleAssetIds } from "@/domain/article";
import type { Collection } from "@/domain/collection";
import {
  buildContextPack,
  type ContextPack,
  type ContextPackAsset,
  type ContextPackSource,
} from "@/domain/context-pack";
import { decodeTextDocument, documentMimeType } from "@/domain/document";
import { normalizeItem, type Item } from "@/domain/item";
import { linkScreenshots } from "@/domain/link-screenshot";
import { noteImageAssetIds } from "@/domain/note";
import type { Tag } from "@/domain/tag";
import { getDb } from "./db";
import { readPdfText } from "./pdf-document";

/** Everything a pack needs, read once so toggling options never reads the library again. */
export type ContextPackSnapshot = {
  items: Item[];
  tags: Tag[];
  collections: Collection[];
  pinnedItemIds: string[];
  assets: Map<string, ContextPackAsset>;
  sources: Map<string, Uint8Array | Blob>;
  documentText: Map<string, string | null>;
};

export type ContextPackProgress = Readonly<{ phase: "reading" | "extracting-text" | "writing"; completed?: number; total?: number }>;

function imageAssetIds(item: Item): string[] {
  if (item.type === "link") {
    return [...(item.previewAssetId ? [item.previewAssetId] : []), ...linkScreenshots(item).map((shot) => shot.assetId), ...articleAssetIds(item.article)];
  }
  if (item.type === "note") return noteImageAssetIds(item.content);
  if (item.type === "image") return item.assetIds;
  if (item.type === "document" || item.type === "video") return item.noteContent ? noteImageAssetIds(item.noteContent) : [];
  return [];
}

function screenshotSizes(items: Item[]): Map<string, { width: number; height: number }> {
  return new Map(items.flatMap((item) => item.type === "link" ? linkScreenshots(item).map((shot) => [shot.assetId, { width: shot.width, height: shot.height }] as const) : []));
}

/**
 * Reads the items (in the given order, Trash excluded), their organization, and
 * every referenced file in one consistent transaction, then extracts document
 * text outside it.
 */
export async function readContextPackSnapshot(
  itemIds: readonly string[],
  options: { pinnedItemIds?: readonly string[]; onProgress?: (progress: ContextPackProgress) => void; signal?: AbortSignal } = {},
): Promise<ContextPackSnapshot> {
  options.signal?.throwIfAborted();
  options.onProgress?.({ phase: "reading" });
  const db = getDb();
  const snapshot = await db.transaction("r", [db.items, db.tags, db.collections, db.assets, db.videoAssets, db.documentAssets, db.previewLayouts], async () => {
    const rows = await db.items.bulkGet([...new Set(itemIds)]);
    const items = rows.flatMap((row) => row && row.deletedAt === undefined ? [normalizeItem(row)] : []);
    const [tags, collections] = await Promise.all([db.tags.toArray(), db.collections.toArray()]);
    const assets = new Map<string, ContextPackAsset>();
    const sources = new Map<string, Uint8Array | Blob>();
    const pdfBytes = new Map<string, Uint8Array>();
    const documentText = new Map<string, string | null>();
    const sizes = screenshotSizes(items);

    const imageIds = [...new Set(items.flatMap(imageAssetIds))];
    const [imageRows, layouts] = await Promise.all([db.assets.bulkGet(imageIds), db.previewLayouts.bulkGet(imageIds)]);
    imageRows.forEach((row, index) => {
      if (!row) return;
      const size = sizes.get(row.id) ?? layouts[index] ?? undefined;
      assets.set(row.id, {
        id: row.id, store: "assets", mimeType: row.mimeType, byteLength: row.byteLength,
        ...(row.contentHash ? { sha256: row.contentHash } : {}),
        ...(size ? { width: size.width, height: size.height } : {}),
      });
      sources.set(row.id, row.bytes);
    });

    for (const item of items) {
      if (item.type === "video") {
        const video = await db.videoAssets.get(item.assetId);
        if (!video) continue;
        assets.set(video.id, { id: video.id, store: "videoAssets", mimeType: video.mimeType, byteLength: video.byteLength });
        sources.set(video.id, video.blob);
      } else if (item.type === "document") {
        const original = await db.documentAssets.get(item.assetId);
        if (!original) { documentText.set(item.id, null); continue; }
        assets.set(original.id, {
          id: original.id, store: "documentAssets", mimeType: documentMimeType(item.format), byteLength: original.byteLength,
          ...(original.contentHash ? { sha256: original.contentHash } : {}),
        });
        sources.set(original.id, original.bytes);
        if (item.format !== "pdf") documentText.set(item.id, safeDecode(original.bytes));
        else if (original.pdfText !== undefined) documentText.set(item.id, original.pdfText.trim() ? original.pdfText : null);
        else pdfBytes.set(item.id, original.bytes);
      }
    }

    const order = new Map(itemIds.map((id, index) => [id, index]));
    items.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return { items, tags, collections, assets, sources, documentText, pdfBytes };
  });

  // PDF text extraction uses a worker, so it runs after the read transaction closes.
  const pending = [...snapshot.pdfBytes];
  for (const [index, [itemId, bytes]] of pending.entries()) {
    options.signal?.throwIfAborted();
    options.onProgress?.({ phase: "extracting-text", completed: index, total: pending.length });
    snapshot.documentText.set(itemId, await readPdfText(bytes).then((text) => text.trim() ? text : null, () => null));
  }
  return {
    items: snapshot.items, tags: snapshot.tags, collections: snapshot.collections, assets: snapshot.assets,
    sources: snapshot.sources, documentText: snapshot.documentText, pinnedItemIds: [...(options.pinnedItemIds ?? [])],
  };
}

function safeDecode(bytes: Uint8Array): string | null {
  try {
    return decodeTextDocument(bytes);
  } catch {
    return null;
  }
}

export function contextPackFromSnapshot(
  snapshot: ContextPackSnapshot,
  options: { name: string; source: ContextPackSource; includeFiles: boolean; exportedAt?: number; appVersion?: string },
): ContextPack {
  return buildContextPack({
    name: options.name,
    exportedAt: options.exportedAt ?? Date.now(),
    appVersion: options.appVersion,
    source: options.source,
    items: snapshot.items,
    tags: snapshot.tags,
    collections: snapshot.collections,
    pinnedItemIds: snapshot.pinnedItemIds,
    includeFiles: options.includeFiles,
    assets: snapshot.assets,
    documentText: snapshot.documentText,
  });
}

/** Streams a built pack into a ZIP. Media is stored without recompression; text is deflated. */
export async function writeContextPackArchive(
  pack: ContextPack,
  snapshot: Pick<ContextPackSnapshot, "sources">,
  options: { onProgress?: (progress: ContextPackProgress) => void; signal?: AbortSignal } = {},
): Promise<Blob> {
  const writer = new ZipWriter(new BlobWriter("application/zip"));
  const lastModDate = new Date(pack.manifest.exportedAt);
  try {
    for (const [index, file] of pack.files.entries()) {
      options.signal?.throwIfAborted();
      options.onProgress?.({ phase: "writing", completed: index, total: pack.files.length });
      if ("text" in file) {
        await writer.add(file.path, new TextReader(file.text), { lastModDate });
        continue;
      }
      const source = snapshot.sources.get(file.asset.id);
      if (!source) throw new Error(`A file for ${file.path} is no longer in the library.`);
      // isView, not instanceof: stored bytes can come from another realm (workers, IndexedDB shims).
      const reader = ArrayBuffer.isView(source) ? new Uint8ArrayReader(new Uint8Array(source.buffer, source.byteOffset, source.byteLength)) : new BlobReader(source);
      await writer.add(file.path, reader, { lastModDate, level: 0 });
    }
    options.onProgress?.({ phase: "writing", completed: pack.files.length, total: pack.files.length });
    return await writer.close();
  } catch (error) {
    await writer.close().catch(() => {});
    throw error;
  }
}

export function contextPackFileName(pack: Pick<ContextPack, "root">): string {
  return `${pack.root}.zip`;
}
