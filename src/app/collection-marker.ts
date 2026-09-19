import type { CSSProperties } from "react";

type MarkerStyle = CSSProperties & {
  "--collection-marker-hue": number;
  "--collection-marker-lightness": number;
};

/** Decorative only; identity, not row position or name, determines the color. */
export function collectionMarkerStyle(id: string): MarkerStyle {
  let hash = 2166136261;
  for (const character of id) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  // Mix similar IDs so their markers do not cluster around the same hue.
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  hash = (hash ^ (hash >>> 16)) >>> 0;

  return {
    "--collection-marker-hue": (hash % 36000) / 100,
    "--collection-marker-lightness": 0.64 + ((hash >>> 16) % 12) / 100,
  };
}
