import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ItemOrganizerDrawer } from "./item-organizer-drawer";

test("offers a separate Unsorted action only for organized items and disables it while busy", () => {
  const onMoveToUnsorted = vi.fn();
  const props = { open: true, onOpenChange: vi.fn(), side: "right" as const, itemTitle: "Note", tags: [{ id: "t", name: "Reference" }], collections: [{ id: "c", name: "Reading" }], tagSuggestions: [], collectionSuggestions: [], disabled: false, pendingTag: false, pendingCollection: false, tagError: null, collectionError: null, onAddTag: vi.fn(), onRemoveTag: vi.fn(), onMoveToCollection: vi.fn(), onMoveToUnsorted };
  const { rerender } = render(<ItemOrganizerDrawer {...props} />);
  expect(screen.getByText("Currently in Reading.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Move to Unsorted" }));
  expect(onMoveToUnsorted).toHaveBeenCalledOnce();
  expect(props.onMoveToCollection).not.toHaveBeenCalled();
  rerender(<ItemOrganizerDrawer {...props} disabled pendingCollection collectionError="Couldn't move to Unsorted." />);
  expect(screen.getByRole("button", { name: "Moving…" })).toBeDisabled();
  rerender(<ItemOrganizerDrawer {...props} collections={[]} />);
  expect(screen.getByText("Currently unsorted.")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Move to Unsorted" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Remove tag Reference" })).toBeVisible();
});
