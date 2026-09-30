import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { LibraryBulkPanels } from "./library-bulk-bar";

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
