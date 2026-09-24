import sharp from "sharp";
import { PreviewFetchError } from "./preview-fetch";

export const MAX_STORED_PREVIEW_BYTES = 512 * 1024;

/** Resize fetched OG art before sending it through the preview API. */
export async function optimizePreviewImage(input: Uint8Array): Promise<{
  bytes: Uint8Array;
  mimeType: "image/webp";
}> {
  try {
    for (const width of [1200, 960, 720, 480]) {
      for (const quality of [80, 65, 50]) {
        const result = await sharp(input, { limitInputPixels: 40_000_000, animated: false })
          .rotate()
          .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
          .webp({ quality })
          .toBuffer();
        if (result.byteLength <= MAX_STORED_PREVIEW_BYTES) {
          return { bytes: new Uint8Array(result), mimeType: "image/webp" };
        }
      }
    }
  } catch {
    throw new PreviewFetchError("Could not process image");
  }
  throw new PreviewFetchError("Image too large");
}
