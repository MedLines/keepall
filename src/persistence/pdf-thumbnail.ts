import { getDb } from "./db";
import { getDocumentRevision } from "./documents";
import { openPdf } from "./pdf-document";
import { rememberPreviewLayout } from "./preview-layouts";

/** Two small first-page renders at a time; completed thumbnails contain no original bytes. */
type ThumbnailEntry = { promise: Promise<string | null>; image?: string };
const thumbnails = new Map<string, ThumbnailEntry>();
let currentRevision: string | null = null;
let active = 0;
const waiting: (() => void)[] = [];

async function renderThumbnail(assetId: string): Promise<string | null> {
  if (active >= 2) await new Promise<void>(resolve => waiting.push(resolve));
  else active++;
  let task: Awaited<ReturnType<typeof openPdf>> | undefined;
  try {
    const original = await getDb().documentAssets.get(assetId);
    if (!original) return null;
    task = await openPdf(original.bytes);
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(480 / base.width, 640 / base.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    void rememberPreviewLayout(assetId, canvas.width, canvas.height).catch(() => {});
    await page.render({ canvas, viewport, annotationMode: 0 }).promise;
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    try { await task?.destroy(); }
    finally {
      const next = waiting.shift();
      if (next) next(); else active--;
    }
  }
}

/** Memory only, so returning to a rendered PDF does not replay its placeholder. */
export function peekPdfThumbnail(assetId: string): string | null {
  return currentRevision === null ? null : thumbnails.get(`${currentRevision}:${assetId}`)?.image ?? null;
}

export async function getPdfThumbnail(assetId: string): Promise<string | null> {
  currentRevision = await getDocumentRevision();
  const key = `${currentRevision}:${assetId}`;
  const cached = thumbnails.get(key);
  if (cached) { thumbnails.delete(key); thumbnails.set(key, cached); return cached.promise; }
  const entry: ThumbnailEntry = { promise: Promise.resolve(null) };
  entry.promise = renderThumbnail(assetId).then(image => {
    if (thumbnails.get(key) === entry) {
      if (image) entry.image = image;
      else thumbnails.delete(key);
    }
    return image;
  }).catch(() => { if (thumbnails.get(key) === entry) thumbnails.delete(key); return null; });
  thumbnails.set(key, entry);
  while (thumbnails.size > 32) thumbnails.delete(thumbnails.keys().next().value!);
  return entry.promise;
}
