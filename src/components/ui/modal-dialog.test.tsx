import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ModalDialog } from "./modal-dialog";

test("Escape and close are blocked while busy and work again when idle", async () => {
  const onOpenChange = vi.fn();
  const props = { open: true, onOpenChange, title: "Import backup", description: "Choose how to import.", footer: <button type="button">Merge</button> };
  const { rerender } = render(<ModalDialog {...props} busy />);
  const dialog = screen.getByRole("dialog", { name: "Import backup" });
  expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(onOpenChange).not.toHaveBeenCalled();
  rerender(<ModalDialog {...props} busy={false} />);
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
});

test("dismissal interception leaves the parent open until the caller accepts it", async () => {
  const onOpenChange = vi.fn();
  const onDismiss = vi.fn((details: { cancel: () => void }) => details.cancel());
  render(<ModalDialog open onOpenChange={onOpenChange} onDismiss={onDismiss} title="Edit draft" description="Unsaved draft" footer={<button>Save</button>} />);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(onDismiss).toHaveBeenCalledOnce());
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: "Edit draft" })).toBeVisible();
});
