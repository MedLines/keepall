import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ItemOrganizerDrawer } from "./item-organizer-drawer";

function organizerProps() {
  return {
    open: true, onOpenChange: vi.fn(), side: "right" as const, itemTitle: "Note",
    tags: [{ id: "t", name: "Reference" }], collections: [{ id: "c", name: "Reading" }],
    tagSuggestions: [{ id: "t", name: "Reference" }, { id: "t2", name: "Review" }],
    collectionSuggestions: [{ id: "c", name: "Reading" }, { id: "c2", name: "Writing" }],
    disabled: false, pendingTag: false, pendingCollection: false,
    tagError: null, collectionError: null,
    onAddTag: vi.fn(), onRemoveTag: vi.fn(), onMoveToCollection: vi.fn(), onMoveToUnsorted: vi.fn(),
  };
}

test("organizes immediately with the same choice chips as capture", () => {
  const props = organizerProps();
  const { rerender } = render(<ItemOrganizerDrawer {...props} />);
  expect(screen.getByRole("button", { name: "Reading" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Writing" }));
  expect(props.onMoveToCollection).toHaveBeenCalledWith("Writing");
  fireEvent.click(screen.getByRole("button", { name: "Unsorted" }));
  expect(props.onMoveToUnsorted).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Review" }));
  expect(props.onAddTag).toHaveBeenCalledWith("Review");
  fireEvent.click(screen.getByRole("button", { name: "Remove tag Reference" }));
  expect(props.onRemoveTag).toHaveBeenCalledWith("t");
  rerender(<ItemOrganizerDrawer {...props} collections={[]} />);
  expect(screen.getByRole("button", { name: "Unsorted" })).toHaveAttribute("aria-pressed", "true");
});

test("filters inline choices and creates names with Enter or the plus create action", () => {
  const props = organizerProps();
  render(<ItemOrganizerDrawer {...props} />);
  const tagInput = screen.getByRole("textbox", { name: "Add tag" });
  fireEvent.change(tagInput, { target: { value: "Rev" } });
  expect(screen.getByRole("button", { name: "Review" })).toBeVisible();
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  fireEvent.change(tagInput, { target: { value: "  New tag  " } });
  fireEvent.keyDown(tagInput, { key: "Enter" });
  expect(props.onAddTag).toHaveBeenCalledWith("New tag");
  expect(tagInput).toHaveValue("");
  const collectionInput = screen.getByRole("textbox", { name: "Move to collection" });
  fireEvent.change(collectionInput, { target: { value: "Ideas" } });
  fireEvent.click(screen.getByRole("button", { name: "Create collection “Ideas”" }));
  expect(props.onMoveToCollection).toHaveBeenCalledWith("Ideas");
  expect(collectionInput).toHaveValue("");
});

test("browses all choices in a nested picker and returns to the organizer", () => {
  const props = organizerProps();
  render(<ItemOrganizerDrawer {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Browse all tags" }));
  const picker = screen.getByRole("dialog", { name: "Choose a tag" });
  fireEvent.click(within(picker).getByRole("button", { name: "Review" }));
  expect(props.onAddTag).toHaveBeenCalledWith("Review");
  expect(screen.getByRole("dialog", { name: "Organize Note" })).toBeVisible();
});

test("disables choices while saving and keeps errors next to their section", () => {
  const props = organizerProps();
  render(<ItemOrganizerDrawer {...props} disabled pendingCollection collectionError="Couldn't move to Unsorted." tagError="Couldn't add this tag." />);
  expect(screen.getByRole("button", { name: "Unsorted" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Remove tag Reference" })).toBeDisabled();
  expect(screen.getByRole("textbox", { name: "Add tag" })).toBeDisabled();
  expect(screen.getByText("Couldn't move to Unsorted.")).toBeVisible();
  expect(screen.getByText("Couldn't add this tag.")).toBeVisible();
});
