import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { DEFAULT_SHORTCUTS } from "@/domain/keyboard-shortcuts";
import { putKeyboardShortcuts } from "@/persistence/library-preferences";
import { SHORTCUTS_CHANGED_EVENT, useAppShortcuts } from "./use-app-shortcuts";

function Harness({ action }: { action: () => void }) {
  const shortcuts = useAppShortcuts({ capture: action });
  return <><span>{shortcuts.capture}</span><input aria-label="Draft" /><div contentEditable suppressContentEditableWarning data-testid="editor">Draft</div></>;
}

describe("app shortcut handling", () => {
  test("updates persisted bindings and leaves typing, composition, repeats and dialogs alone", async () => {
    const action = vi.fn();
    render(<Harness action={action} />);
    fireEvent.keyDown(window, { code: "KeyK", altKey: true });
    expect(action).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByLabelText("Draft"), { code: "KeyK", altKey: true });
    fireEvent.keyDown(screen.getByTestId("editor"), { code: "KeyK", altKey: true });
    fireEvent.keyDown(window, { code: "KeyK", altKey: true, isComposing: true });
    fireEvent.keyDown(window, { code: "KeyK", altKey: true, repeat: true });
    const dialog = document.createElement("div"); dialog.setAttribute("role", "dialog"); document.body.append(dialog);
    fireEvent.keyDown(window, { code: "KeyK", altKey: true }); dialog.remove();
    expect(action).toHaveBeenCalledTimes(1);
    await putKeyboardShortcuts({ ...DEFAULT_SHORTCUTS, capture: "Alt+KeyJ" });
    window.dispatchEvent(new Event(SHORTCUTS_CHANGED_EVENT));
    await waitFor(() => expect(screen.getByText("Alt+KeyJ")).toBeInTheDocument());
    fireEvent.keyDown(window, { code: "KeyK", altKey: true });
    fireEvent.keyDown(window, { code: "KeyJ", altKey: true });
    expect(action).toHaveBeenCalledTimes(2);
  });
});
