import { getAsset } from "./assets";
import { getDb } from "./db";

async function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.75));
}

/** Derived, replaceable preview. An unreadable image keeps its original safe. */
export async function imageThumbnail(bytes: Uint8Array, mimeType: string): Promise<Blob | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
  try {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: mimeType }));
    const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvasBlob(canvas);
  } catch {
    return null;
  }
}

export async function putThumbnail(assetId: string, blob: Blob | null): Promise<void> {
  if (blob) await getDb().thumbnails.put({ assetId, blob });
}

export async function getThumbnail(assetId: string): Promise<Blob | null> {
  const existing = await getDb().thumbnails.get(assetId);
  if (existing) return existing.blob;
  const asset = await getAsset(assetId);
  if (!asset || !asset.mimeType.startsWith("image/")) return null;
  const blob = await imageThumbnail(asset.bytes, asset.mimeType);
  await putThumbnail(assetId, blob);
  return blob;
}
