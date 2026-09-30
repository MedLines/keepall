import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { buildNote } from "@/domain/note";
import { buildLink } from "@/domain/link";
import { LinkItemEditDialog, NoteItemEditDialog } from "./item-edit-dialog";

describe("shared note edit dialog", () => {
  test("saves exactly once with Ctrl+Enter", () => {
    const onSave = vi.fn();
    render(<NoteItemEditDialog item={buildNote({ content: "A test note" })} open busy={false} error={null} onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Note content" }), { key: "Enter", ctrlKey: true });
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith({ content: "A test note", format: "plain", images: [] });
  });

  test("keeps its draft and error after a failed save and offers images and preview", () => {
    const item = buildNote({ content: "Original note" });
    const onSave = vi.fn();
    const onOpenChange = vi.fn();
    const props = { item, open: true, busy: false, error: null as string | null, onSave, onOpenChange };
    const { rerender } = render(<NoteItemEditDialog {...props} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Note content" }), { target: { value: "Revised note" } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    rerender(<NoteItemEditDialog {...props} error="Couldn't save note." />);
    expect(screen.getByRole("textbox", { name: "Note content" })).toHaveValue("Revised note");
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save note.");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Add image at cursor" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByLabelText("Note preview")).toHaveTextContent("Revised note");
    expect(screen.getByRole("button", { name: "Add image at cursor" })).toBeDisabled();
  });
  test("switches format while previewing without losing the draft", () => {
    const onSave = vi.fn();
    render(<NoteItemEditDialog item={buildNote({ content: "# My heading" })} open busy={false} error={null} onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByLabelText("Note preview")).toHaveTextContent("# My heading");
    fireEvent.click(screen.getByRole("button", { name: "Markdown" }));
    expect(screen.getByRole("heading", { name: "My heading" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Preview" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("textbox", { name: "Note content" })).toHaveValue("# My heading");
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    expect(onSave).toHaveBeenCalledWith({ content: "# My heading", format: "markdown", images: [] });
  });

});

test("dirty note Escape keeps the draft until discard is confirmed", async () => {
  const onOpenChange = vi.fn();
  render(<NoteItemEditDialog item={buildNote({ content: "Original" })} open busy={false} error={null} onOpenChange={onOpenChange} onSave={vi.fn()} />);
  const editor = screen.getByRole("textbox", { name: "Note content" });
  fireEvent.change(editor, { target: { value: "Unsaved" } });
  fireEvent.keyDown(editor, { key: "Escape" });
  expect(await screen.findByRole("dialog", { name: "Discard unsaved changes?" })).toBeVisible();
  expect(onOpenChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(editor).toHaveValue("Unsaved");
  fireEvent.keyDown(editor, { key: "Escape" });
  fireEvent.click(await screen.findByRole("button", { name: "Discard changes" }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
});


test("media edits use an immutable baseline, with immediate footer cancel and pristine reversion", async () => {
  const item = buildLink({ url: "https://example.com", title: "Original" });
  const onOpenChange = vi.fn();
  const props = { item, open: true, busy: false, error: null, onOpenChange, onSave: vi.fn() };
  const { rerender } = render(<LinkItemEditDialog {...props} />);
  const title = screen.getByRole("textbox", { name: "Title" });
  fireEvent.change(title, { target: { value: "Changed" } });
  rerender(<LinkItemEditDialog {...props} item={{ ...item, title: "Changed" }} />);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  const confirmation = await screen.findByRole("dialog", { name: "Discard unsaved changes?" });
  await waitFor(() => expect(within(confirmation).getByRole("button", { name: "Keep editing" })).toHaveFocus());
  fireEvent.keyDown(confirmation, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Discard unsaved changes?" })).toBeNull());
  expect(onOpenChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
  expect(onOpenChange).toHaveBeenCalledOnce();
  onOpenChange.mockClear();
  fireEvent.change(title, { target: { value: "Original" } });
  fireEvent.keyDown(title, { key: "Escape" });
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(screen.queryByRole("dialog", { name: "Discard unsaved changes?" })).toBeNull();
});
