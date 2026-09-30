import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { buildNote } from "@/domain/note";
import { NoteItemEditDialog } from "./item-edit-dialog";

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
