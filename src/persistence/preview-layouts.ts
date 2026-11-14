import type { Item } from "@/domain/item";
import { noteImageAssetIds } from "@/domain/note";
import { linkCoverAssetId } from "@/domain/link-screenshot";
import { assetToBlob, getAsset } from "./assets";
import { getDb, type PreviewLayout } from "./db";

const layouts = new Map<string, PreviewLayout>();

/** Render-time reads use memory only; startup loads the small, derived records. */
export function peekPreviewLayout(assetId: string | null | undefined) {
  return assetId ? layouts.get(assetId) : undefined;
}

export function itemPreviewAssetId(item: Item): string | null {
  if (item.type === "image") return item.assetIds[0] ?? null;
  if (item.type === "link") return linkCoverAssetId(item);
  if (item.type === "video" || item.type === "document") return item.assetId;
  return null;
}

export async function loadPreviewLayouts(items: Item[]) {
  const used = new Set(items.flatMap(item => item.type === "image" ? item.assetIds
    : item.type === "note" ? noteImageAssetIds(item.content) : [itemPreviewAssetId(item)].filter((id): id is string => Boolean(id))));
  const records = await getDb().previewLayouts.toArray();
  // Keep sizes learned while this read was in flight; drop only assets no item uses.
  for (const assetId of layouts.keys()) if (!used.has(assetId)) layouts.delete(assetId);
  for (const record of records) if (used.has(record.assetId)) layouts.set(record.assetId, record);
  const unused = records.filter(record => !used.has(record.assetId)).map(record => record.assetId);
  if (unused.length) await getDb().previewLayouts.bulkDelete(unused);
}

/** The asset a grid card shows, and whether the grid shows its thumbnail. */
function gridMedia(item: Item): { assetId: string; thumbnail: boolean } | null {
  if (item.type === "link") {
    const assetId = linkCoverAssetId(item);
    return assetId ? { assetId, thumbnail: false } : null;
  }
  if (item.type === "image") return item.assetIds[0] ? { assetId: item.assetIds[0], thumbnail: true } : null;
  if (item.type === "video") return { assetId: item.assetId, thumbnail: true };
  return null;
}

async function storedImage(assetId: string, preferThumbnail: boolean): Promise<Blob | null> {
  const thumbnail = async () => (await getDb().thumbnails.get(assetId))?.blob ?? null;
  const original = async () => {
    const asset = await getAsset(assetId);
    return asset?.mimeType.startsWith("image/") ? assetToBlob(asset) : null;
  };
  return preferThumbnail ? (await thumbnail()) ?? original() : (await original()) ?? thumbnail();
}

async function decodedSize(blob: Blob): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== "function") return null;
  const bitmap = await createImageBitmap(blob);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

function idle(): Promise<void> {
  return new Promise(resolve => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(() => resolve(), { timeout: 250 });
    else setTimeout(resolve, 0);
  });
}

const backfilling = new Set<string>();
/** Decodes run off the main thread, so a few at once finish the backfill before most scrolls reach it. */
const BACKFILL_BATCH = 6;

/**
 * Learns the size of grid media that has never finished loading, in list order and in idle time.
 * Without it those cards mount at an estimated height and grow when the image decodes, which
 * pushes every card below them in the column.
 */
export async function backfillPreviewLayouts(items: Item[], isCancelled: () => boolean = () => false): Promise<number> {
  if (typeof createImageBitmap !== "function") return 0;
  const pending = new Map<string, boolean>();
  for (const item of items) {
    const media = gridMedia(item);
    if (media && !layouts.has(media.assetId) && !backfilling.has(media.assetId)) pending.set(media.assetId, media.thumbnail);
  }
  const queue = [...pending];
  let learned = 0;
  for (let start = 0; start < queue.length && !isCancelled(); start += BACKFILL_BATCH) {
    const batch = queue.slice(start, start + BACKFILL_BATCH);
    const results = await Promise.all(batch.map(([assetId, thumbnail]) => learnPreviewLayout(assetId, thumbnail)));
    learned += results.filter(Boolean).length;
    await idle();
  }
  return learned;
}

async function learnPreviewLayout(assetId: string, thumbnail: boolean): Promise<boolean> {
  if (layouts.has(assetId) || backfilling.has(assetId)) return false;
  backfilling.add(assetId);
  try {
    const blob = await storedImage(assetId, thumbnail);
    const size = blob ? await decodedSize(blob) : null;
    if (!size || layouts.has(assetId)) return false;
    await rememberPreviewLayout(assetId, size.width, size.height);
    return true;
  } catch {
    // An unreadable image keeps its estimate; the card learns its size if it ever loads.
    return false;
  } finally {
    backfilling.delete(assetId);
  }
}

export async function rememberPreviewLayout(assetId: string, width: number, height: number) {
  if (!(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) return;
  const current = layouts.get(assetId);
  if (current?.width === width && current.height === height) return;
  const layout = { assetId, width, height };
  layouts.set(assetId, layout);
  await getDb().previewLayouts.put(layout);
}
