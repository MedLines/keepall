import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { LibraryBulkPanels, LibraryBulkToolbar } from "./library-bulk-bar";

test("selection toolbar exposes actions in a menu and preserves selection on Escape", async () => {
  const onClearSelection = vi.fn();
  const onSelectAllVisible = vi.fn();
  const onOpenPanel = vi.fn();
  const { rerender } = render(<>
    <input id="library-search" aria-label="Search" type="search" />
    <LibraryBulkToolbar count={0} allVisibleSelected={false} busy={false}
      onClearSelection={onClearSelection} onOpenPanel={onOpenPanel}
      onSelectAllVisible={onSelectAllVisible} />
  </>);

  rerender(<>
    <input id="library-search" aria-label="Search" type="search" />
    <LibraryBulkToolbar count={2} allVisibleSelected={false} busy={false}
      onClearSelection={onClearSelection} onOpenPanel={onOpenPanel}
      onSelectAllVisible={onSelectAllVisible} />
  </>);
  const trigger = screen.getByRole("button", { name: "Selection actions: 2 selected" });
  trigger.focus();
  fireEvent.click(trigger);
  expect(screen.getByRole("menuitem", { name: "Select all" })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(onClearSelection).not.toHaveBeenCalled();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("menuitem", { name: "Deselect all" }));
  expect(onClearSelection).toHaveBeenCalledOnce();
  await waitFor(() => expect(screen.getByRole("searchbox", { name: "Search" })).toHaveFocus());
});

test("selection menu offers only permanent deletion in Trash and disables actions while busy", () => {
  const onDeletePermanently = vi.fn();
  const { rerender } = render(<LibraryBulkToolbar count={1} allVisibleSelected busy
    onClearSelection={vi.fn()} onOpenPanel={vi.fn()}
    onSelectAllVisible={vi.fn()} onDeletePermanently={onDeletePermanently} />);
  const trigger = screen.getByRole("button", { name: "Selection actions: 1 selected" });
  expect(trigger).toBeDisabled();
  fireEvent.click(trigger);
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  rerender(<LibraryBulkToolbar count={1} allVisibleSelected busy={false}
    onClearSelection={vi.fn()} onOpenPanel={vi.fn()}
    onSelectAllVisible={vi.fn()} onDeletePermanently={onDeletePermanently} />);
  fireEvent.click(trigger);
  expect(screen.queryByRole("menuitem", { name: "Organize" })).not.toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: "Move to Trash" })).not.toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: "Delete permanently" })).toBeInTheDocument();
});

test("bulk trash confirmation puts Cancel before the destructive action", () => {
  const onClosePanel = vi.fn();
  const onConfirmDelete = vi.fn();
  render(<LibraryBulkPanels
    count={4} panel="delete" busy={false} error={null}
    tagDraft="" collectionDraft="" tagSuggestions={[]} removeTagSuggestions={[]} collectionSuggestions={[]}
    pendingAddTag={false} pendingRemoveTag={false} pendingAddCollection={false} pendingDelete={false}
    onClosePanel={onClosePanel} onConfirmDelete={onConfirmDelete}
    onTagDraftChange={vi.fn()} onCollectionDraftChange={vi.fn()}
    onBulkAddTag={vi.fn()} onBulkRemoveTag={vi.fn()} onBulkRemoveAllTags={vi.fn()} onBulkAddCollection={vi.fn()}
  />);
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getAllByRole("button").map((button) => button.textContent?.trim()))
    .toEqual(["", "Cancel", "Move to Trash"]);
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(onClosePanel).toHaveBeenCalledOnce();
  expect(onConfirmDelete).not.toHaveBeenCalled();
});

test("bulk organization exposes tags and collections together with Done", () => {
  const onClosePanel = vi.fn();
  render(<LibraryBulkPanels
    count={2} panel="organize" busy={false} error={null}
    tagDraft="" collectionDraft="" tagSuggestions={[]} removeTagSuggestions={[]} collectionSuggestions={[]}
    pendingAddTag={false} pendingRemoveTag={false} pendingAddCollection={false} pendingDelete={false}
    onClosePanel={onClosePanel} onConfirmDelete={vi.fn()}
    onTagDraftChange={vi.fn()} onCollectionDraftChange={vi.fn()}
    onBulkAddTag={vi.fn()} onBulkRemoveTag={vi.fn()} onBulkRemoveAllTags={vi.fn()} onBulkAddCollection={vi.fn()}
  />);
  const dialog = screen.getByRole("dialog", { name: "Organize 2 selected items" });
  expect(within(dialog).getByRole("combobox", { name: "Add tag to selection" })).toBeVisible();
  expect(within(dialog).getByRole("combobox", { name: "Move selection to collection" })).toBeVisible();
  fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  expect(onClosePanel).toHaveBeenCalledOnce();
});
