import sharp from "sharp";
import { articleImages, MAX_ARTICLE_IMAGE_BYTES, MAX_ARTICLE_IMAGES, MAX_ARTICLE_IMAGES_BYTES, type ArticleNode, type CapturedArticleImage } from "@/domain/article";
import { fetchPublicArticlePage } from "./article-http";
import { parsePreviewCandidateUrl } from "./preview-ssrf";

const IMAGE_ACCEPT = "image/avif,image/webp,image/png,image/jpeg,image/gif";
const IMAGE_TYPES = new Set(IMAGE_ACCEPT.split(","));
const MAX_OUTPUT_BYTES = 1024 * 1024;
const MAX_INPUT_PIXELS = 16_000_000;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

type CaptureOptions = {
  signal: AbortSignal;
  deadline: number;
  fetchImpl?: typeof fetch;
  assertUrl?: (url: string) => Promise<URL>;
};

async function abortable<T>(pending: Promise<T>, signal: AbortSignal, onAbort?: () => void): Promise<T> {
  let abort: (() => void) | undefined;
  return Promise.race([pending, new Promise<never>((_, reject) => {
    abort = () => { onAbort?.(); reject(signal.reason); };
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  })]).finally(() => { if (abort) signal.removeEventListener("abort", abort); });
}

async function readImage(response: Response, signal: AbortSignal): Promise<Buffer> {
  if (!response.body) throw new Error("Empty article image.");
  if (Number(response.headers.get("content-length")) > MAX_ARTICLE_IMAGE_BYTES) {
    await response.body.cancel();
    throw new Error("Article image exceeds source limit.");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const chunk = await abortable(reader.read(), signal, () => { void reader.cancel().catch(() => {}); });
      signal.throwIfAborted();
      if (chunk.done) return Buffer.concat(chunks, bytes);
      bytes += chunk.value.byteLength;
      if (bytes > MAX_ARTICLE_IMAGE_BYTES) throw new Error("Article image exceeds source limit.");
      chunks.push(chunk.value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

async function fetchImage(source: string, options: CaptureOptions): Promise<Buffer> {
  const fetchImpl = options.fetchImpl ?? ((url, init) => fetchPublicArticlePage(String(url), init!.signal as AbortSignal, IMAGE_ACCEPT));
  let current = source;
  for (let hop = 0; hop <= 5; hop++) {
    options.signal.throwIfAborted();
    const parsed = parsePreviewCandidateUrl(current);
    const allowed = options.assertUrl ? await abortable(options.assertUrl(parsed.href), options.signal) : parsed;
    const response = await abortable(fetchImpl(allowed.href, { method: "GET", redirect: "manual", cache: "no-store", signal: options.signal, headers: { Accept: IMAGE_ACCEPT } }), options.signal);
    if (REDIRECTS.has(response.status)) {
      await response.body?.cancel();
      const destination = response.headers.get("location");
      if (!destination) throw new Error("Article image redirect has no destination.");
      current = new URL(destination, allowed).href;
      continue;
    }
    const mime = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!response.ok || !IMAGE_TYPES.has(mime)) {
      await response.body?.cancel();
      throw new Error("Unsupported article image response.");
    }
    return readImage(response, options.signal);
  }
  throw new Error("Article image redirected too many times.");
}

function isRaster(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return true;
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return true;
  if (["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) return true;
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return true;
  const brands = bytes.toString("ascii", 8, 64);
  return bytes.toString("ascii", 4, 8) === "ftyp" && /avif|avis/.test(brands);
}

async function encodeImage(source: Buffer, options: CaptureOptions, maxBytes: number): Promise<Buffer | null> {
  if (!isRaster(source)) throw new Error("Article image is not a supported raster.");
  for (const [size, quality] of [[1600, 82], [1200, 72], [960, 65]]) {
    options.signal.throwIfAborted();
    const seconds = Math.max(1, Math.ceil((options.deadline - Date.now()) / 1000));
    const pipeline = sharp(source, { limitInputPixels: MAX_INPUT_PIXELS, animated: false, failOn: "error" })
      .rotate().resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
      .webp({ quality }).timeout({ seconds });
    const result = await abortable(pipeline.toBuffer(), options.signal, () => { pipeline.destroy(); });
    options.signal.throwIfAborted();
    if (result.byteLength <= maxBytes) return result;
  }
  return null;
}

/** Failed images retain their semantic placeholders; article text is always kept. */
export async function captureArticleImages(content: ArticleNode[] | undefined, options: CaptureOptions): Promise<CapturedArticleImage[]> {
  const sources = [...new Set(articleImages(content).flatMap(image => image.src ? [image.src] : []))].slice(0, MAX_ARTICLE_IMAGES);
  const images: CapturedArticleImage[] = [];
  let storedBytes = 0;
  for (const sourceUrl of sources) {
    if (options.signal.aborted || Date.now() >= options.deadline || storedBytes >= MAX_ARTICLE_IMAGES_BYTES) break;
    try {
      const source = await fetchImage(sourceUrl, options);
      const image = await encodeImage(source, options, Math.min(MAX_OUTPUT_BYTES, MAX_ARTICLE_IMAGES_BYTES - storedBytes));
      if (!image) continue;
      storedBytes += image.byteLength;
      images.push({ sourceUrl, mimeType: "image/webp", dataBase64: image.toString("base64") });
    } catch { if (options.signal.aborted) break; }
  }
  return images;
}
