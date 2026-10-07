import { normalizeItem } from "@/domain/item";
import { validateImageAnalysis, type ImageAnalysis } from "@/domain/image-analysis";
import type { ImageItem } from "@/domain/image";
import { getDb } from "./db";

/** Merge a delayed analysis result into the current row without clobbering edits. */
export async function saveImageAnalysis(itemId: string, result: ImageAnalysis): Promise<ImageItem> {
  const db = getDb();
  return db.transaction("rw", db.items, async () => {
    const row = await db.items.get(itemId);
    if (!row || row.type !== "image" || row.deletedAt !== undefined) throw new Error("Image not found");
    const item = normalizeItem(row);
    if (!item.assetIds.includes(result.assetId)) throw new Error("This image has been replaced or removed");
    const existing = item.analysis?.find(entry => entry.assetId === result.assetId);
    const analysis = validateImageAnalysis([
      ...(item.analysis ?? []).filter(entry => entry.assetId !== result.assetId),
      { ...existing, ...result },
    ], item.assetIds);
    const updated = { ...item, analysis, updatedAt: Date.now() };
    await db.items.put(updated);
    return updated;
  });
}
