import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { buildNote } from "@/domain/note";
import type { OrganizationPreview } from "@/domain/organization-preview";
import { LibraryFolderArtwork } from "./library-collections";
import { LibraryOrganizationOverview } from "./library-organization-overview";
import { LibraryTagArtwork } from "./library-tags";

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

test("compact tag previews omit note bodies while grid previews retain them", () => {
  const { container, rerender } = render(<LibraryTagArtwork previews={previews.slice(0, 2)} compact />);
  expect(container.querySelectorAll(".library-tag-preview")).toHaveLength(2);
  expect(container.querySelector(".library-tag-note-content, .library-tag-preview-type")).toBeNull();
  expect(container).not.toHaveTextContent("Content 3");
  rerender(<LibraryTagArtwork previews={previews.slice(0, 2)} />);
  expect(container).toHaveTextContent("Content 3");
});

test.each(["collections", "tags"] as const)("%s list keeps opening, selection, and menu actions separate", async kind => {
  const open = vi.fn();
  const select = vi.fn();
  const remove = vi.fn();
  const entries: OrganizationPreview[] = [{ organization: { id: "c", name: "Games" }, count: 2, previews: previews.slice(0, 2), itemTypes: ["note"] }];
  const props = {
    entries,
    layout: "list" as const, kind, query: "", selectedIds: new Set<string>(), busy: false,
    hrefFor: () => "/?collection=c", onOpen: open, onToggleSelect: select, onDelete: remove,
  };
  const { container, rerender } = render(<LibraryOrganizationOverview {...props} />);
  const artwork = container.querySelector(kind === "collections" ? ".collection-folder-stage" : ".library-tag-stage");
  expect(artwork).not.toBeNull();
  fireEvent.click(screen.getByRole("link", { name: "Open Games, 2 items" }));
  expect(open).toHaveBeenCalledOnce();
  expect(open).toHaveBeenCalledWith("c");
  open.mockClear();
  fireEvent.click(screen.getByRole("checkbox", { name: "Select Games" }));
  expect(select).toHaveBeenCalledOnce();
  expect(select).toHaveBeenCalledWith("c");
  expect(open).not.toHaveBeenCalled();

  rerender(<LibraryOrganizationOverview {...props} selectedIds={new Set(["c"])} />);
  expect(screen.getByRole("checkbox", { name: "Select Games" })).toBeChecked();
  expect(container.querySelector(kind === "collections" ? ".collection-folder-stage" : ".library-tag-stage")).toBe(artwork);
  fireEvent.click(screen.getByRole("button", { name: "Games actions" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: `Delete ${kind === "collections" ? "folder" : "tag"}` }));
  expect(remove).toHaveBeenCalledWith(["c"]);
  expect(select).toHaveBeenCalledOnce();
  expect(open).not.toHaveBeenCalled();
});
