import { describe, expect, it } from "vitest";
import { extractPixelPalette, matchesPaletteColor, validateImageAnalysis } from "./image-analysis";
import { buildImage, replaceImageAssetAt, removeImageAssetAt } from "./image";
import { matchesSearchQuery, findSearchExcerpt } from "./search";

describe("image analysis", () => {
  it("ignores transparent pixels and returns dominant separated colors", () => {
    expect(extractPixelPalette(new Uint8ClampedArray([255,0,0,255, 255,0,0,255, 0,0,255,255, 0,255,0,0]))).toEqual(["#FF0000", "#0000FF"]);
  });
  it("keeps a small vivid accent ahead of extra shades of a pale background", () => {
    const pixel = (r: number, g: number, b: number, n: number) => Array.from({ length: n }, () => [r, g, b, 255]).flat();
    // Glossy jelly shapes on lavender: six distinct colours each cover more area than the green ball.
    const pixels = new Uint8ClampedArray([
      ...pixel(221, 209, 249, 100), ...pixel(182, 122, 243, 30), ...pixel(4, 103, 245, 15),
      ...pixel(247, 41, 137, 15), ...pixel(253, 136, 6, 15), ...pixel(56, 135, 252, 13), ...pixel(137, 201, 4, 10),
    ]);
    expect(extractPixelPalette(pixels)).toContain("#89C904");
  });
  it("matches nearby hex and named families, rejecting unknown filters", () => {
    expect(matchesPaletteColor(["#FE0101"], "#ff0000")).toBe(true);
    expect(matchesPaletteColor(["#FE0101"], "red")).toBe(true);
    expect(matchesPaletteColor(["#FE0101"], "blue")).toBe(false);
    expect(matchesPaletteColor(["#FE0101"], "chartreuse-ish")).toBe(false);
  });
  it("includes nearby shades beyond the old RGB radius without matching unrelated hues", () => {
    for (const shade of ["#CC3333", "#B83D3D", "#FF8080"]) {
      expect(matchesPaletteColor([shade], "#FF0000"), shade).toBe(true);
      expect(matchesPaletteColor(["#FF0000"], shade), shade).toBe(true);
    }
    for (const unrelated of ["#00FF00", "#0000FF", "#FFFFFF", "#000000"]) {
      expect(matchesPaletteColor([unrelated], "#FF0000"), unrelated).toBe(false);
    }
  });
  it("uses the same nearby-color range for library search across gallery slides", () => {
    const image = { ...buildImage({ assetId: "a" }), assetIds: ["a", "b"], analysis: [{ assetId: "b", palette: ["#B83D3D"] }] };
    expect(matchesSearchQuery(image, "color:#FF0000")).toBe(true);
    expect(matchesSearchQuery(image, "color:#0000FF")).toBe(false);
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
