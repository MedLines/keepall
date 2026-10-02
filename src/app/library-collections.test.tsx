import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { buildNote } from "@/domain/note";
import { LibraryFolderArtwork } from "./library-collections";

const previews = [3, 2, 1, 0].map(now => buildNote({ title: `Item ${now}`, content: `Content ${now}` }, { id: `n${now}`, now }));

test.each([0, 1, 2, 3, 4])("folder positions %i previews with the newest in the center", count => {
  const { container } = render(<LibraryFolderArtwork previews={previews.slice(0, count)} itemTypes={count > 0 ? ["note"] : []} />);
  const tiles = container.querySelectorAll(".collection-folder-preview");
  expect(tiles).toHaveLength(Math.min(count, 3));
  expect(Array.from(tiles, tile => tile.getAttribute("data-position"))).toEqual(["center", "left", "right"].slice(0, count));
  if (count > 0) expect(tiles[0]).toHaveTextContent("Item 3");
});

test("folder front shows each content type once, including types outside the previews", () => {
  const { container } = render(<LibraryFolderArtwork previews={previews.slice(0, 3)} itemTypes={["note", "link", "image", "video"]} />);
  const types = container.querySelectorAll('.collection-folder-front .collection-folder-type');
  expect(Array.from(types, icon => icon.getAttribute('data-type'))).toEqual(["note", "link", "image", "video"]);
  for (const icon of types) expect(icon.querySelector('svg')).not.toBeNull();
});

test("empty folder has no content-type icons", () => {
  const { container } = render(<LibraryFolderArtwork previews={[]} itemTypes={[]} />);
  expect(container.querySelector('.collection-folder-types')).toBeNull();
});
