import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, test, vi } from "vitest";
import type { Collection } from "@/domain/collection";
import type { Tag } from "@/domain/tag";
import { JumpPalette, jumpResults, type JumpFilter } from "./jump-palette";

const collections: Collection[] = ["Typography", "Design", "Archive", "Travel"].map((name, index) => ({ id: `c${index}`, name, createdAt: index, pinnedItemIds: [] }));
const tags: Tag[] = ["type-scale", "colour", "motion", "fonts", "grid", "layout", "react", "css"].map((name, index) => ({ id: `t${index}`, name, createdAt: index }));
const tagCounts = Object.fromEntries(tags.map((tag, index) => [tag.id, index]));

function results(query: string, filter: JumpFilter = "all", pinnedCollectionIds: string[] = []) {
  return jumpResults({ collections, tags, pinnedCollectionIds, collectionCounts: {}, tagCounts, query, filter }).map(result => result.name);
}

describe("jumpResults", () => {
  test("puts names that start with the query first", () => {
    expect(results("ty")).toEqual(["Typography", "type-scale"]);
    expect(results("a", "collections")).toEqual(["Archive", "Travel", "Typography"]);
  });

  test("lists pinned collections first and the most used tags when there is no query", () => {
    expect(results("", "all", ["c3"]).slice(0, 4)).toEqual(["Travel", "Archive", "Design", "Typography"]);
    expect(results("", "all").slice(4)).toEqual(["css", "react", "layout", "grid", "fonts", "motion"]);
  });

  test("keeps a short list of each kind under All and the full list under one kind", () => {
    expect(results("", "all")).toHaveLength(4 + 6);
    expect(results("", "tags")).toEqual(["colour", "css", "fonts", "grid", "layout", "motion", "react", "type-scale"]);
  });
});

function renderPalette(overrides: Partial<Parameters<typeof JumpPalette>[0]> = {}) {
  const props = {
    open: true, onOpenChange: vi.fn(), filter: "collections" as JumpFilter, onFilterChange: vi.fn(),
    collections, tags, pinnedCollectionIds: [], collectionCounts: {}, tagCounts, mutationBusy: false,
    onGoCollection: vi.fn(), onGoTag: vi.fn(), onGoCollections: vi.fn(), onGoTags: vi.fn(),
    onTogglePinnedCollection: vi.fn(), onRenameCollection: vi.fn(), onDeleteCollection: vi.fn(), onDeleteTag: vi.fn(),
    ...overrides,
  };
  render(<JumpPalette {...props} />);
  return { props, palette: screen.getByRole("dialog", { name: "Jump to a collection or tag" }) };
}

describe("JumpPalette", () => {
  beforeAll(() => {
    // jsdom has no layout, so it leaves scrollIntoView out.
    Element.prototype.scrollIntoView ??= () => {};
  });

  test("moves with the arrow keys and opens the highlighted result with Enter", () => {
    const { props, palette } = renderPalette();
    const search = within(palette).getByRole("combobox");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(within(palette).getByRole("option", { name: /^Design/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(search, { key: "Enter" });
    expect(props.onGoCollection).toHaveBeenCalledExactlyOnceWith("c1");
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  test("saves a rename once when Enter submits it", () => {
    const { props, palette } = renderPalette();
    fireEvent.click(within(palette).getByRole("button", { name: "Rename" }));
    const field = within(palette).getByLabelText("Collection name");
    fireEvent.change(field, { target: { value: "Old files" } });
    fireEvent.submit(field.closest("form")!);
    fireEvent.blur(field);
    expect(props.onRenameCollection).toHaveBeenCalledExactlyOnceWith("c2", "Old files");
  });

  test("Escape cancels a rename without saving it", () => {
    const { props, palette } = renderPalette();
    fireEvent.click(within(palette).getByRole("button", { name: "Rename" }));
    const field = within(palette).getByLabelText("Collection name");
    fireEvent.change(field, { target: { value: "Type" } });
    fireEvent.keyDown(field, { key: "Escape" });
    fireEvent.blur(field);
    expect(props.onRenameCollection).not.toHaveBeenCalled();
    expect(within(palette).getByRole("heading", { name: "Archive" })).toBeInTheDocument();
  });

  test("closes before asking to delete, so the confirmation is not stacked under it", () => {
    const { props, palette } = renderPalette({ filter: "tags" });
    fireEvent.click(within(palette).getByRole("button", { name: "Delete" }));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(props.onDeleteTag).toHaveBeenCalledExactlyOnceWith("t1");
  });
});
