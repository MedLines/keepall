import { getDb } from "./db";
import { getDocumentRevision } from "./documents";
import { openPdf } from "./pdf-document";

/** Two small first-page renders at a time; completed thumbnails contain no original bytes. */
const thumbnails = new Map<string, Promise<string | null>>();
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

export async function getPdfThumbnail(assetId: string): Promise<string | null> {
  const key = `${await getDocumentRevision()}:${assetId}`;
  const cached = thumbnails.get(key);
  if (cached) { thumbnails.delete(key); thumbnails.set(key, cached); return cached; }
  const pending = renderThumbnail(assetId).then(image => {
    if (!image && thumbnails.get(key) === pending) thumbnails.delete(key);
    return image;
  }).catch(() => { if (thumbnails.get(key) === pending) thumbnails.delete(key); return null; });
  thumbnails.set(key, pending);
  while (thumbnails.size > 32) thumbnails.delete(thumbnails.keys().next().value!);
  return pending;
}
