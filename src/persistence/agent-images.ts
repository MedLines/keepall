import type { AgentImageRef } from "@/domain/agent-tools";
import { getAsset } from "./assets";
import { getDb } from "./db";
import { getPdfThumbnail } from "./pdf-thumbnail";

export type AgentImage = { label: string; mimeType: string; width: number; height: number; data: string };

/** Claude reads images best up to about this long side; larger ones are scaled down by the model anyway. */
export const DETAIL_LONG_SIDE = 1568;
/** Moodboards of many items trade detail for room. */
export const OVERVIEW_LONG_SIDE = 1092;
const TARGET_BYTES = 600_000;

async function sourceBlob(ref: AgentImageRef): Promise<Blob | null> {
  if (ref.source === "asset") {
    const asset = await getAsset(ref.id);
    return asset?.mimeType.startsWith("image/") ? new Blob([asset.bytes.slice()], { type: asset.mimeType }) : null;
  }
  if (ref.source === "video-poster") return (await getDb().thumbnails.get(ref.id))?.blob ?? null;
  const page = await getPdfThumbnail(ref.id);
  return page ? (await fetch(page)).blob() : null;
}

async function encode(bitmap: ImageBitmap, longSide: number, quality: number) {
  const scale = Math.min(1, longSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No 2D canvas");
  context.drawImage(bitmap, 0, 0, width, height);
  return { blob: await canvas.convertToBlob({ type: "image/webp", quality }), width, height };
}

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

/**
 * A resized copy for the agent, decoded and re-encoded locally so originals never leave the library.
 * Returns null for anything the browser can't decode; the caller reports it instead of failing the request.
 */
export async function loadAgentImage(ref: AgentImageRef, longSide = DETAIL_LONG_SIDE): Promise<AgentImage | null> {
  const blob = await sourceBlob(ref).catch(() => null);
  if (!blob) return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }
  try {
    let encoded = await encode(bitmap, longSide, 0.82);
    if (encoded.blob.size > TARGET_BYTES) encoded = await encode(bitmap, Math.min(longSide, OVERVIEW_LONG_SIDE), 0.72);
    return { label: ref.label, mimeType: encoded.blob.type || "image/webp", width: encoded.width, height: encoded.height, data: toBase64(await encoded.blob.arrayBuffer()) };
  } catch {
    return null;
  } finally {
    bitmap.close();
  }
}
