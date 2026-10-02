import { OKLCH_to_XYZ_D65, XYZ_D65_to_sRGB } from "@csstools/color-helpers";

/** Convert authored OKLCH literals for consumers that require legacy sRGB. */
export function oklchToRgba(color) {
  const match = /^oklch\(([\d.]+)(%)?\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+)(%)?)?\)$/.exec(color);
  if (!match) throw new Error(`Expected a numeric OKLCH literal: ${color}`);
  const lightness = Number(match[1]) / (match[2] ? 100 : 1);
  const channels = XYZ_D65_to_sRGB(OKLCH_to_XYZ_D65([lightness, Number(match[3]), Number(match[4])]));
  const [r, g, b] = channels.map(channel => Math.round(Math.max(0, Math.min(1, channel)) * 255));
  const alpha = match[5] === undefined ? 1 : Number(match[5]) / (match[6] ? 100 : 1);
  return { r, g, b, alpha };
}

export function oklchToHex(color) {
  const { r, g, b, alpha } = oklchToRgba(color);
  const channels = alpha === 1 ? [r, g, b] : [r, g, b, Math.round(alpha * 255)];
  return `#${channels.map(channel => channel.toString(16).padStart(2, "0")).join("")}`;
}

/** Sharp's SVG renderer cannot read OKLCH. Convert only at rasterization. */
export function svgToSrgb(svg) {
  return svg.replace(/oklch\([^()]*\)/g, oklchToHex);
}
