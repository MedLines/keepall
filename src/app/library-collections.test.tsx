import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { buildNote } from "@/domain/note";
import { LibraryFolderArtwork } from "./library-collections";

const previews = [3, 2, 1, 0].map(now => buildNote({ title: `Item ${now}`, content: `Content ${now}` }, { id: `n${now}`, now }));

test.each([0, 1, 2, 3, 4])("folder positions %i previews with the newest in the center", count => {
  const { container } = render(<LibraryFolderArtwork previews={previews.slice(0, count)} />);
  const tiles = container.querySelectorAll(".collection-folder-preview");
  expect(tiles).toHaveLength(Math.min(count, 3));
  expect(Array.from(tiles, tile => tile.getAttribute("data-position"))).toEqual(["center", "left", "right"].slice(0, count));
  if (count > 0) expect(tiles[0]).toHaveTextContent("Item 3");
});
