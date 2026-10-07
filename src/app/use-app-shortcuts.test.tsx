import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { DEFAULT_SHORTCUTS } from "@/domain/keyboard-shortcuts";
import type { ShortcutAction } from "@/domain/keyboard-shortcuts";
import { putKeyboardShortcuts } from "@/persistence/library-preferences";
import { SHORTCUTS_CHANGED_EVENT, useAppShortcuts } from "./use-app-shortcuts";

function Harness({ action }: { action: () => void }) {
  const shortcuts = useAppShortcuts({ capture: action });
  return <><span>{shortcuts.capture}</span><input aria-label="Draft" /><div contentEditable suppressContentEditableWarning data-testid="editor">Draft</div></>;
}

describe("app shortcut handling", () => {
  test("all four customized bindings dispatch their actions after loading", async () => {
    const custom = { capture: "Alt+KeyJ", search: "Alt+KeyM", toggleLayout: "Alt+KeyN", preview: "Alt+KeyO" };
    await putKeyboardShortcuts(custom);
    const actions = { capture: vi.fn(), search: vi.fn(), toggleLayout: vi.fn(), preview: vi.fn() };
    function AllActions() {
      const shortcuts = useAppShortcuts(actions);
      return <span>{JSON.stringify(shortcuts)}</span>;
    }
    render(<AllActions />);
    await screen.findByText(JSON.stringify(custom));
    for (const [action, code] of [["capture", "KeyJ"], ["search", "KeyM"], ["toggleLayout", "KeyN"], ["preview", "KeyO"]] as [ShortcutAction, string][]) {
      fireEvent.keyDown(window, { code, altKey: true });
      expect(actions[action]).toHaveBeenCalledTimes(1);
    }
    fireEvent.keyDown(window, { code: "KeyK", altKey: true });
    expect(actions.capture).toHaveBeenCalledTimes(1);
  });
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
    const recorder = document.createElement("div"); recorder.setAttribute("data-shortcut-recording", ""); document.body.append(recorder);
    fireEvent.keyDown(window, { code: "KeyK", altKey: true }); recorder.remove();
    expect(action).toHaveBeenCalledTimes(1);
    await putKeyboardShortcuts({ ...DEFAULT_SHORTCUTS, capture: "Alt+KeyJ" });
    window.dispatchEvent(new Event(SHORTCUTS_CHANGED_EVENT));
    await waitFor(() => expect(screen.getByText("Alt+KeyJ")).toBeInTheDocument());
    fireEvent.keyDown(window, { code: "KeyK", altKey: true });
    fireEvent.keyDown(window, { code: "KeyJ", altKey: true });
    expect(action).toHaveBeenCalledTimes(2);
  });
});
