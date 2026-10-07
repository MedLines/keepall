import { describe, expect, it } from "vitest";
import { extractPixelPalette, matchesPaletteColor, validateImageAnalysis } from "./image-analysis";
import { buildImage, replaceImageAssetAt, removeImageAssetAt } from "./image";
import { matchesSearchQuery, findSearchExcerpt } from "./search";

describe("image analysis", () => {
  it("ignores transparent pixels and returns dominant separated colors", () => {
    expect(extractPixelPalette(new Uint8ClampedArray([255,0,0,255, 255,0,0,255, 0,0,255,255, 0,255,0,0]))).toEqual(["#FF0000", "#0000FF"]);
  });
  it("matches nearby hex and named families, rejecting unknown filters", () => {
    expect(matchesPaletteColor(["#FE0101"], "#ff0000")).toBe(true);
    expect(matchesPaletteColor(["#FE0101"], "red")).toBe(true);
    expect(matchesPaletteColor(["#FE0101"], "blue")).toBe(false);
    expect(matchesPaletteColor(["#FE0101"], "chartreuse-ish")).toBe(false);
  });
  it("searches OCR across slides and composes colors with literal text", () => {
    const image = { ...buildImage({ assetId: "a", title: "Receipt" }), assetIds: ["a", "b"], analysis: [{ assetId: "b", palette: ["#FF0000"], ocr: { text: "Invoice 4823", confidence: 91, language: "eng" as const, extractedAt: 100 } }] };
    expect(matchesSearchQuery(image, "color:red invoice")).toBe(true);
    expect(matchesSearchQuery(image, "color:blue invoice")).toBe(false);
    expect(matchesSearchQuery(image, "color:unknown")).toBe(false);
    expect(findSearchExcerpt(image, "invoice")?.label).toBe("Image text");
  });
  it("rejects orphaned or oversized backup metadata", () => {
    expect(() => validateImageAnalysis([{ assetId: "lost", palette: ["#FFFFFF"] }], ["a"])).toThrow();
    expect(() => validateImageAnalysis([{ assetId: "a", palette: ["red"] }], ["a"])).toThrow();
    expect(() => validateImageAnalysis([{ assetId: "a", ocr: { text: "x".repeat(100001), confidence: 99, language: "eng", extractedAt: 1 } }], ["a"])).toThrow();
  });
  it("drops metadata for replaced or removed assets without losing remaining slides", () => {
    const image = { ...buildImage({ assetId: "a" }), assetIds: ["a", "b"], analysis: [{ assetId: "a", palette: ["#FF0000"] }, { assetId: "b", palette: ["#0000FF"] }] };
    expect(replaceImageAssetAt(image, 0, "c").analysis).toEqual([image.analysis[1]]);
    expect(removeImageAssetAt(image, 0).analysis).toEqual([image.analysis[1]]);
  });
});
