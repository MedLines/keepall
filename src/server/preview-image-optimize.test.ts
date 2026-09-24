import { describe, expect, test } from "vitest";
import sharp from "sharp";
import { optimizePreviewImage, MAX_STORED_PREVIEW_BYTES } from "./preview-image-optimize";

describe("optimizePreviewImage", () => {
  test("turns a large source into a bounded static card preview", async () => {
    const source = await sharp({ create: {
      width: 2000, height: 1200, channels: 3, background: "#407baa",
    } }).png().toBuffer();
    const result = await optimizePreviewImage(new Uint8Array(source));
    const metadata = await sharp(result.bytes).metadata();
    expect(result.mimeType).toBe("image/webp");
    expect(result.bytes.byteLength).toBeLessThanOrEqual(MAX_STORED_PREVIEW_BYTES);
    expect(metadata.width).toBeLessThanOrEqual(1200);
    expect(metadata.height).toBeLessThanOrEqual(1200);
  });
});
