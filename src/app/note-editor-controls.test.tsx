import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { NoteEditorControls } from "./note-editor-controls";

test("read-only format keeps preview available and reports control changes", () => {
  const onFormatChange = vi.fn(); const onPreviewChange = vi.fn();
  const { rerender } = render(<NoteEditorControls format="plain" preview={false} formatDisabled onFormatChange={onFormatChange} onPreviewChange={onPreviewChange} />);
  expect(screen.getByRole("button", { name: "Markdown" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Preview" }));
  expect(onPreviewChange).toHaveBeenCalledWith(true);
  rerender(<NoteEditorControls format="plain" preview={false} onFormatChange={onFormatChange} onPreviewChange={onPreviewChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Markdown" }));
  expect(onFormatChange).toHaveBeenCalledWith("markdown");
});

test("busy controls cannot enable format through an explicit false override", () => {
  render(<NoteEditorControls format="markdown" preview disabled formatDisabled={false} onFormatChange={vi.fn()} onPreviewChange={vi.fn()} />);
  for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
});
