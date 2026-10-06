import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { OPEN_CAPTURE_EVENT } from "./capture-events";
import { DEFAULT_LIBRARY_LAYOUT, DEFAULT_LIBRARY_SORT, type LibraryViewState } from "@/domain/library-view";
import { LibraryEmptyState, getEmptyStateKind, entireLibrarySearch } from "./library-empty-state";

describe("LibraryEmptyState", () => {
  test("offers a first save in a new library", () => {
    render(<LibraryEmptyState kind="first-save" message="No items yet." onClearFilters={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "A place for what you want to keep" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Import bookmarks or files" })).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save your first item" })).toBeVisible();
  });

  test.each([
    ["collection", "No items in this collection."],
    ["unsorted", "No unsorted items."],
  ] as const)("offers a save action for an empty %s view", (kind, message) => {
    render(<LibraryEmptyState kind={kind} message={message} onClearFilters={vi.fn()} />);
    const onOpen = vi.fn();
    window.addEventListener(OPEN_CAPTURE_EVENT, onOpen);
    fireEvent.click(screen.getByRole("button", { name: "Save an item" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_CAPTURE_EVENT, onOpen);
  });

  test("explains an empty trash without save or import actions", () => {
    render(<LibraryEmptyState kind="trash" message="Trash is empty." onClearFilters={vi.fn()} />);
    expect(screen.getByText("Trash is empty.")).toBeInTheDocument();
    expect(screen.getByText(/restore them or empty the trash/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  test("lets a filtered empty view clear its filters", () => {
    const onClearFilters = vi.fn();
    render(<LibraryEmptyState kind="filtered" message="No matching items." onClearFilters={onClearFilters} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});

const baseView: LibraryViewState = { q: "", collection: null, unsorted: false, tag: null, type: null, layout: DEFAULT_LIBRARY_LAYOUT, sort: DEFAULT_LIBRARY_SORT, item: null, slide: 0 };

describe("empty state scope", () => {
  test("shows first-save only for an entirely empty unfiltered library", () => {
    expect(getEmptyStateKind(baseView, false, 0)).toBe("first-save");
    expect(getEmptyStateKind(baseView, false, 1)).toBe("library");
    expect(getEmptyStateKind({ ...baseView, collection: "work" }, false, 0)).toBe("collection");
    expect(getEmptyStateKind({ ...baseView, trash: true }, false, 0)).toBe("trash");
    expect(getEmptyStateKind({ ...baseView, unsorted: true }, false, 0)).toBe("unsorted");
    expect(getEmptyStateKind({ ...baseView, type: "image" }, false, 0)).toBe("filtered");
    expect(getEmptyStateKind({ ...baseView, q: "plan" }, true, 0)).toBe("filtered");
  });

  test.each([{ collection: "work" }, { unsorted: true }, { tag: "tag" }, { type: "image" as const }])("broader search preserves the query and clears item scope %o", scope => {
    expect(entireLibrarySearch({ ...baseView, ...scope, q: "a plan", item: "old", slide: 2 })).toEqual({ q: "a plan", collection: null, unsorted: false, tag: null, type: null, item: null, slide: 0 });
  });

  test.each([{ trash: true, collection: "work" }, { collections: true }, { tags: true }, {}])("does not broaden Trash, overview, or whole-library searches %o", scope => {
    expect(entireLibrarySearch({ ...baseView, ...scope, q: "plan" })).toBeNull();
  });

  test("does not offer broader search without a query", () => {
    expect(entireLibrarySearch({ ...baseView, collection: "work", q: "  " })).toBeNull();
  });

  test("names query and scope and offers both recovery actions", () => {
    const broader = vi.fn();
    const clear = vi.fn();
    render(<LibraryEmptyState kind="filtered" message="No matching items." query="quarterly" scope="Work · image items" onClearFilters={clear} onSearchEntireLibrary={broader} />);
    expect(screen.getByRole("heading")).toHaveTextContent("quarterly");
    expect(screen.getByText("Searching Work · image items")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Search entire library" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(broader).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledOnce();
  });

  test("first-save import opens the existing bulk-import path", () => {
    const onOpen = vi.fn();
    window.addEventListener(OPEN_CAPTURE_EVENT, onOpen);
    render(<LibraryEmptyState kind="first-save" message="No items yet." onClearFilters={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Import bookmarks or files" }));
    expect(onOpen.mock.calls[0][0].detail).toEqual({ bulkImport: true });
    window.removeEventListener(OPEN_CAPTURE_EVENT, onOpen);
  });
});
