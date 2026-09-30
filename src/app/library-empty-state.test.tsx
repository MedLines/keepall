import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { OPEN_CAPTURE_EVENT } from "./capture-events";
import { LibraryEmptyState } from "./library-empty-state";

describe("LibraryEmptyState", () => {
  test("offers a first save and Settings import in a new library", () => {
    render(<LibraryEmptyState kind="library" message="No items yet." onClearFilters={vi.fn()} />);
    expect(screen.getByText("No items yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Import from Settings" })).toHaveAttribute("href", "/settings");
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
