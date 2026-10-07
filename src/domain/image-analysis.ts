export const MAX_OCR_TEXT_LENGTH = 100_000;
export type ImageAnalysis = {
  assetId: string;
  palette?: string[];
  ocr?: { text: string; confidence: number; language: "eng"; extractedAt: number };
};

const HEX = /^#[0-9a-f]{6}$/i;

/** Metadata is small, bounded, and references original gallery assets. */
export function validateImageAnalysis(raw: unknown, assetIds: readonly string[]): ImageAnalysis[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > assetIds.length) throw new Error("Invalid image analysis");
  const seen = new Set<string>();
  return raw.map(entry => {
    if (!entry || typeof entry !== "object" || typeof entry.assetId !== "string" || !assetIds.includes(entry.assetId) || seen.has(entry.assetId)) throw new Error("Image analysis needs a unique gallery asset");
    seen.add(entry.assetId);
    const result: ImageAnalysis = { assetId: entry.assetId };
    if (entry.palette !== undefined) {
      if (!Array.isArray(entry.palette) || entry.palette.length > 6 || entry.palette.some((color: unknown) => typeof color !== "string" || !HEX.test(color))) throw new Error("Invalid image palette");
      result.palette = entry.palette.map((color: string) => color.toUpperCase());
    }
    if (entry.ocr !== undefined) {
      const ocr = entry.ocr;
      if (!ocr || typeof ocr.text !== "string" || ocr.text.length > MAX_OCR_TEXT_LENGTH || ocr.language !== "eng" || !Number.isFinite(ocr.confidence) || ocr.confidence < 0 || ocr.confidence > 100 || !Number.isFinite(ocr.extractedAt) || ocr.extractedAt < 0) throw new Error("Invalid image text");
      result.ocr = { text: ocr.text, confidence: ocr.confidence, language: "eng", extractedAt: ocr.extractedAt };
    }
    return result;
  });
}

export function retainImageAnalysis(analysis: ImageAnalysis[] | undefined, assetIds: readonly string[]): ImageAnalysis[] | undefined {
  if (!analysis) return undefined;
  return analysis.filter(entry => assetIds.includes(entry.assetId));
}

function rgb(hex: string): number[] {
  return [1, 3, 5].map(start => Number.parseInt(hex.slice(start, start + 2), 16));
}
function distance(a: number[], b: number[]): number {
  return Math.hypot(...a.map((value, index) => value - b[index]));
}

/** Quantized frequency counts on a downsampled image; transparent pixels do not contribute. */
export function extractPixelPalette(pixels: Uint8ClampedArray): string[] {
  const buckets = new Map<number, { count: number; sums: number[] }>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const channels = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const key = (channels[0] >> 4) * 256 + (channels[1] >> 4) * 16 + (channels[2] >> 4);
    const bucket = buckets.get(key) ?? { count: 0, sums: [0, 0, 0] };
    bucket.count++;
    channels.forEach((value, index) => { bucket.sums[index] += value; });
    buckets.set(key, bucket);
  }
  const selected: number[][] = [];
  for (const bucket of [...buckets.values()].sort((a, b) => b.count - a.count)) {
    const color = bucket.sums.map(value => Math.round(value / bucket.count));
    if (selected.every(existing => distance(existing, color) > 60)) selected.push(color);
    if (selected.length === 6) break;
  }
  return selected.map(color => `#${color.map(value => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`);
}

export const PALETTE_COLOR_FAMILIES = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink", "white", "gray", "black"] as const;
export function paletteColorFamily(hex: string): string {
  const [r, g, b] = rgb(hex).map(value => value / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  if (max < 0.18) return "black";
  if (delta < 0.12) return min > 0.82 ? "white" : "gray";
  let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  if (hue < 20 || hue >= 345) return "red";
  if (hue < 45) return "orange";
  if (hue < 70) return "yellow";
  if (hue < 165) return "green";
  if (hue < 195) return "cyan";
  if (hue < 260) return "blue";
  if (hue < 295) return "purple";
  return "pink";
}
export function matchesPaletteColor(palette: readonly string[], query: string): boolean {
  const color = query.toLowerCase();
  if (!HEX.test(color)) return palette.some(hex => paletteColorFamily(hex) === color);
  const target = oklab(color);
  return palette.some(hex => distance(oklab(hex), target) <= 0.18);
}

/** OKLab makes the search radius follow perceived color rather than RGB channel steps. */
function oklab(hex: string): number[] {
  const [r, g, b] = rgb(hex).map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
