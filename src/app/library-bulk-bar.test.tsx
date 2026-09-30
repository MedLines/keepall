import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
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

  const reservedToolbar = document.querySelector('[aria-label="Bulk actions"]');
  expect(reservedToolbar).not.toBeNull();
  expect(screen.queryByRole("region", { name: "Bulk actions" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Select all" })).not.toBeInTheDocument();

  rerender(<>
    <input id="library-search" aria-label="Search" type="search" />
    <LibraryBulkToolbar count={2} allVisibleSelected={false} busy={false}
      onClearSelection={onClearSelection} onOpenPanel={onOpenPanel}
      onSelectAllVisible={onSelectAllVisible} />
  </>);
  expect(screen.getByRole("region", { name: "Bulk actions" })).toBe(reservedToolbar);
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

test("selection menu offers restore before permanent deletion in Trash and disables actions while busy", () => {
  const onDeletePermanently = vi.fn();
  const onRestoreSelected = vi.fn();
  const { rerender } = render(<LibraryBulkToolbar count={1} allVisibleSelected busy
    onClearSelection={vi.fn()} onOpenPanel={vi.fn()}
    onSelectAllVisible={vi.fn()} onDeletePermanently={onDeletePermanently} onRestoreSelected={onRestoreSelected} />);
  const trigger = screen.getByRole("button", { name: "Selection actions: 1 selected" });
  expect(trigger).toBeDisabled();
  fireEvent.click(trigger);
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  rerender(<LibraryBulkToolbar count={1} allVisibleSelected busy={false}
    onClearSelection={vi.fn()} onOpenPanel={vi.fn()}
    onSelectAllVisible={vi.fn()} onDeletePermanently={onDeletePermanently} onRestoreSelected={onRestoreSelected} />);
  fireEvent.click(trigger);
  expect(screen.queryByRole("menuitem", { name: "Organize" })).not.toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: "Move to Trash" })).not.toBeInTheDocument();
  expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Deselect all", "Restore selected", "Delete permanently"]);
  fireEvent.click(screen.getByRole("menuitem", { name: "Restore selected" }));
  expect(onRestoreSelected).toHaveBeenCalledOnce();
});

test("hidden selection is visible without opening the menu and can be cleared", () => {
  const onClearHidden = vi.fn();
  render(<LibraryBulkToolbar count={2} hiddenCount={1} allVisibleSelected busy={false}
    onClearSelection={vi.fn()} onClearHidden={onClearHidden}
    onSelectAllVisible={vi.fn()} />);
  expect(screen.getByRole("region", { name: "Bulk actions" })).toHaveTextContent("1 hidden");
  const trigger = screen.getByRole("button", { name: "Selection actions: 2 selected" });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("menuitem", { name: "Clear hidden selection" }));
  expect(onClearHidden).toHaveBeenCalledOnce();
});

test("clearing an entirely hidden selection returns focus to search", async () => {
  function Harness() {
    const [count, setCount] = useState(1);
    return <><input id="library-search" aria-label="Search" type="search" />
      <LibraryBulkToolbar count={count} hiddenCount={count} allVisibleSelected={false} busy={false}
        onClearSelection={() => setCount(0)} onClearHidden={() => setCount(0)}
        onSelectAllVisible={vi.fn()} />
    </>;
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Selection actions: 1 selected" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Clear hidden selection" }));
  await waitFor(() => expect(screen.getByRole("searchbox", { name: "Search" })).toHaveFocus());
  expect(screen.queryByRole("region", { name: "Bulk actions" })).not.toBeInTheDocument();
});

test("bulk trash confirmation puts Cancel before the destructive action", () => {
  const onClosePanel = vi.fn();
  const onConfirmDelete = vi.fn();
  render(<LibraryBulkPanels
    count={4} panel="delete" busy={false} error={null}
    tagDraft="" collectionDraft="" tagSuggestions={[]} removeTagSuggestions={[]} collectionSuggestions={[]}
    pendingAddTag={false} pendingRemoveTag={false} pendingAddCollection={false} pendingClearCollection={false} pendingDelete={false}
    onClosePanel={onClosePanel} onConfirmDelete={onConfirmDelete}
    onTagDraftChange={vi.fn()} onCollectionDraftChange={vi.fn()}
    onBulkAddTag={vi.fn()} onBulkRemoveTag={vi.fn()} onBulkRemoveAllTags={vi.fn()} onBulkAddCollection={vi.fn()} onBulkClearCollection={vi.fn()}
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
    pendingAddTag={false} pendingRemoveTag={false} pendingAddCollection={false} pendingClearCollection={false} pendingDelete={false}
    onClosePanel={onClosePanel} onConfirmDelete={vi.fn()}
    onTagDraftChange={vi.fn()} onCollectionDraftChange={vi.fn()}
    onBulkAddTag={vi.fn()} onBulkRemoveTag={vi.fn()} onBulkRemoveAllTags={vi.fn()} onBulkAddCollection={vi.fn()} onBulkClearCollection={vi.fn()}
  />);
  const dialog = screen.getByRole("dialog", { name: "Organize 2 selected items" });
  expect(within(dialog).getByRole("combobox", { name: "Add tag to selection" })).toBeVisible();
  expect(within(dialog).getByRole("combobox", { name: "Move selection to collection" })).toBeVisible();
  fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  expect(onClosePanel).toHaveBeenCalledOnce();
});


test("inline restore is disabled while busy and absent without Trash callback or selection", () => {
  const onRestoreSelected = vi.fn();
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const props = { count: 2, allVisibleSelected: true, busy: false, onClearSelection: vi.fn(), onSelectAllVisible: vi.fn(), onDeletePermanently: vi.fn(), onRestoreSelected };
  const { rerender } = render(<LibraryBulkToolbar {...props} />);
  const restore = screen.getByRole("button", { name: "Restore selected" });
  fireEvent.click(restore);
  expect(onRestoreSelected).toHaveBeenCalledOnce();
  rerender(<LibraryBulkToolbar {...props} busy />);
  expect(restore).toBeDisabled();
  rerender(<LibraryBulkToolbar {...props} onRestoreSelected={undefined} />);
  expect(screen.queryByRole("button", { name: "Restore selected" })).not.toBeInTheDocument();
  rerender(<LibraryBulkToolbar {...props} count={0} />);
  expect(screen.queryByText("Restore selected")).not.toBeInTheDocument();
  vi.unstubAllGlobals();
});


test("bulk Unsorted action works independently of name input and shows disabled progress", () => {
  const onBulkClearCollection = vi.fn();
  const props = { count: 2, hiddenCount: 1, panel: "organize" as const, busy: false, error: null, tagDraft: "", collectionDraft: "", tagSuggestions: [], removeTagSuggestions: [], collectionSuggestions: [], pendingAddTag: false, pendingRemoveTag: false, pendingAddCollection: false, pendingClearCollection: false, pendingDelete: false, onClosePanel: vi.fn(), onConfirmDelete: vi.fn(), onTagDraftChange: vi.fn(), onCollectionDraftChange: vi.fn(), onBulkAddTag: vi.fn(), onBulkRemoveTag: vi.fn(), onBulkRemoveAllTags: vi.fn(), onBulkAddCollection: vi.fn(), onBulkClearCollection };
  const { rerender } = render(<LibraryBulkPanels {...props} />);
  expect(screen.getByRole("dialog")).toHaveTextContent("including 1 hidden");
  fireEvent.click(screen.getByRole("button", { name: "Move selection to Unsorted" }));
  expect(onBulkClearCollection).toHaveBeenCalledOnce();
  expect(props.onBulkAddCollection).not.toHaveBeenCalled();
  rerender(<LibraryBulkPanels {...props} busy pendingClearCollection />);
  expect(screen.getByRole("button", { name: "Moving…" })).toBeDisabled();
});
