import type { Item } from "@/domain/item";
import { noteImageAssetIds } from "@/domain/note";
import { getDb, type PreviewLayout } from "./db";

const layouts = new Map<string, PreviewLayout>();

/** Render-time reads use memory only; startup loads the small, derived records. */
export function peekPreviewLayout(assetId: string | null | undefined) {
  return assetId ? layouts.get(assetId) : undefined;
}

export function itemPreviewAssetId(item: Item): string | null {
  if (item.type === "image") return item.assetIds[0] ?? null;
  if (item.type === "link") return item.previewAssetId;
  if (item.type === "video" || item.type === "document") return item.assetId;
  return null;
}

export async function loadPreviewLayouts(items: Item[]) {
  const used = new Set(items.flatMap(item => item.type === "image" ? item.assetIds
    : item.type === "note" ? noteImageAssetIds(item.content) : [itemPreviewAssetId(item)].filter((id): id is string => Boolean(id))));
  const records = await getDb().previewLayouts.toArray();
  layouts.clear();
  for (const record of records) if (used.has(record.assetId)) layouts.set(record.assetId, record);
  const unused = records.filter(record => !used.has(record.assetId)).map(record => record.assetId);
  if (unused.length) await getDb().previewLayouts.bulkDelete(unused);
}

export async function rememberPreviewLayout(assetId: string, width: number, height: number) {
  if (!(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) return;
  const current = layouts.get(assetId);
  if (current?.width === width && current.height === height) return;
  const layout = { assetId, width, height };
  layouts.set(assetId, layout);
  await getDb().previewLayouts.put(layout);
}
