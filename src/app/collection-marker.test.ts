import { expect, it } from "vitest";
import { collectionMarkerStyle } from "./collection-marker";

it("keeps a collection's decorative marker stable across reordering", () => {
  const ids = ["design", "product", "photography"];
  const initial = new Map(ids.map(id => [id, collectionMarkerStyle(id)]));
  for (const id of ids.toReversed()) {
    expect(collectionMarkerStyle(id)).toEqual(initial.get(id));
  }
});

it("spreads similar collection IDs across hues without a short repeating palette", () => {
  const styles = Array.from({ length: 200 }, (_, i) => collectionMarkerStyle(`folder-${i}`));
  expect(new Set(styles.map(style => JSON.stringify(style))).size).toBe(200);
  const hueGroups = new Set(styles.map(style => Math.floor(Number(style["--collection-marker-hue"]) / 30)));
  expect(hueGroups.size).toBe(12);
});
