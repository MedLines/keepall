import { expect, test } from "vitest";
import sharp from "sharp";
import { oklchToHex, oklchToRgba, svgToSrgb } from "./color-format.mjs";

test("legacy color consumers receive the original sRGB bytes and alpha", () => {
  expect(oklchToHex("oklch(1 0 0)")).toBe("#ffffff");
  expect(oklchToHex("oklch(0 0 0)")).toBe("#000000");
  expect(oklchToHex("oklch(0.695465853 0.198903916 13.098740726)")).toBe("#ff5b79");
  expect(oklchToHex("oklch(0.210330931 0.005860382 285.885132689)")).toBe("#18181b");
  expect(oklchToHex("oklch(1 0 0 / 0.078431373)")).toBe("#ffffff14");
  expect(oklchToRgba("oklch(1 0 0 / 0.078431373)")).toEqual({ r: 255, g: 255, b: 255, alpha: 0.078431373 });
});

test("API conversion accepts percentage lightness and alpha and rejects unresolved tokens", () => {
  expect(oklchToRgba("oklch(100% 0 0 / 50%)")).toEqual({ r: 255, g: 255, b: 255, alpha: 0.5 });
  expect(() => oklchToHex("var(--color-text-primary)")).toThrow("Expected a numeric OKLCH literal");
});

test("SVG rasterization preserves fills, strokes and gradient stops", async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="1"><defs><linearGradient id="paint"><stop stop-color="oklch(1 0 0)"/><stop offset="1" stop-color="oklch(0 0 0)"/></linearGradient></defs><rect width="1" height="1" fill="oklch(1 0 0)"/><rect x="1" width="1" height="1" fill="oklch(0 0 0)"/></svg>';
  const converted = svgToSrgb(svg);
  expect(converted).toContain('id="paint"');
  expect(converted).not.toContain("oklch(");
  expect([...await sharp(Buffer.from(converted)).ensureAlpha().raw().toBuffer()]).toEqual([255, 255, 255, 255, 0, 0, 0, 255]);
});
