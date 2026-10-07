import { extractPixelPalette, MAX_OCR_TEXT_LENGTH, type ImageAnalysis } from "@/domain/image-analysis";
import { assetToBlob, getAsset } from "@/persistence/assets";

const OCR_PATH = "/ocr/7.0.0/recognize.js";
let ocrActive = false;

async function imageCanvas(assetId: string, maxEdge: number, maxPixels: number, signal: AbortSignal): Promise<HTMLCanvasElement> {
  const asset = await getAsset(assetId);
  if (!asset) throw new Error("Original image is missing");
  signal.throwIfAborted();
  const url = URL.createObjectURL(assetToBlob(asset));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    signal.throwIfAborted();
    if (image.naturalWidth * image.naturalHeight > 32_000_000) throw new Error("This image is too large to analyze. Use an image below 32 megapixels.");
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight), Math.sqrt(maxPixels / (image.naturalWidth * image.naturalHeight)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Image analysis is unavailable in this browser");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally { URL.revokeObjectURL(url); }
}

export async function extractImagePalette(assetId: string, signal: AbortSignal): Promise<ImageAnalysis> {
  const canvas = await imageCanvas(assetId, 160, 25_600, signal);
  const context = canvas.getContext("2d")!;
  return { assetId, palette: extractPixelPalette(context.getImageData(0, 0, canvas.width, canvas.height).data) };
}

export async function recognizeImageText(assetId: string, signal: AbortSignal, onProgress: (status: string, progress: number) => void): Promise<ImageAnalysis> {
  if (ocrActive) throw new Error("Another image is being read. Wait for it to finish.");
  ocrActive = true;
  try {
    onProgress("Preparing image", 0);
    const canvas = await imageCanvas(assetId, 4096, 4_000_000, signal);
    // Flatten transparency onto white so screenshot text remains readable.
    const context = canvas.getContext("2d")!;
    context.globalCompositeOperation = "destination-over";
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Couldn't prepare image")), "image/png"));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    signal.throwIfAborted();
    return await new Promise<ImageAnalysis>((resolve, reject) => {
      const worker = new Worker(OCR_PATH);
      const finish = (result?: ImageAnalysis, error?: Error) => {
        clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
        worker.terminate();
        if (error) reject(error); else resolve(result!);
      };
      const abort = () => finish(undefined, new DOMException("Cancelled", "AbortError"));
      const timeout = setTimeout(() => finish(undefined, new Error("Text recognition took too long. Try a smaller image.")), 120_000);
      signal.addEventListener("abort", abort, { once: true });
      worker.onerror = () => finish(undefined, new Error("Couldn't load text recognition. Reconnect to Keepall, then retry."));
      worker.onmessage = ({ data }) => {
        if (data.type === "progress") onProgress(data.status === "recognizing text" ? "Reading text" : "Loading recognition engine", Math.max(0, Math.min(1, data.progress)));
        if (data.type === "error") finish(undefined, new Error("Couldn't read this image. Check that the recognition engine is available and retry."));
        if (data.type === "result") finish({ assetId, ocr: { text: String(data.text).trim().slice(0, MAX_OCR_TEXT_LENGTH), confidence: Math.max(0, Math.min(100, Number(data.confidence) || 0)), language: "eng", extractedAt: Date.now() } });
      };
      worker.postMessage(bytes, [bytes.buffer]);
    });
  } finally { ocrActive = false; }
}
