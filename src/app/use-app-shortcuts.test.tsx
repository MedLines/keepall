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
  test.each([
    { binding: "KeyS", event: { code: "KeyS", key: "s" } },
    { binding: "Ctrl+Shift+KeyJ", event: { code: "KeyJ", key: "J", ctrlKey: true, shiftKey: true } },
    { binding: "Meta+KeyJ", event: { code: "KeyJ", key: "j", metaKey: true } },
    { binding: "F8", event: { code: "F8", key: "F8" } },
  ])("runs $binding without Alt and protects typing", async ({ binding, event }) => {
    await putKeyboardShortcuts({ ...DEFAULT_SHORTCUTS, capture: binding });
    const capture = vi.fn();
    render(<Harness action={capture} />);
    await screen.findByText(binding);
    fireEvent.keyDown(window, event);
    expect(capture).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByLabelText("Draft"), event);
    fireEvent.keyDown(screen.getByTestId("editor"), event);
    expect(capture).toHaveBeenCalledTimes(1);
  });
  test("an assigned arrow shortcut takes precedence over library navigation", async () => {
    await putKeyboardShortcuts({ ...DEFAULT_SHORTCUTS, capture: "ArrowDown" });
    const capture = vi.fn();
    const navigate = vi.fn();
    function ArrowHarness() {
      const shortcuts = useAppShortcuts({ capture });
      return <button onKeyDown={event => { if (!event.defaultPrevented) navigate(); }}>{shortcuts.capture}</button>;
    }
    render(<ArrowHarness />);
    const target = await screen.findByRole("button", { name: "ArrowDown" });
    fireEvent.keyDown(target, { code: "ArrowDown", key: "ArrowDown" });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });
  test("Space still activates a focused button when assigned as an app shortcut", async () => {
    await putKeyboardShortcuts({ ...DEFAULT_SHORTCUTS, capture: "Space", preview: "F9" });
    const capture = vi.fn();
    function SpaceHarness() {
      const shortcuts = useAppShortcuts({ capture });
      return <button>{shortcuts.capture}</button>;
    }
    render(<SpaceHarness />);
    const target = await screen.findByRole("button", { name: "Space" });
    expect(fireEvent.keyDown(target, { code: "Space", key: " " })).toBe(true);
    expect(capture).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { code: "Space", key: " " });
    expect(capture).toHaveBeenCalledTimes(1);
  });
  test("number-pad / focuses search while / in a typing field stays native", async () => {
    const search = vi.fn();
    function SearchHarness() {
      const shortcuts = useAppShortcuts({ search });
      return <><span>{shortcuts.search}</span><input aria-label="Draft" /></>;
    }
    render(<SearchHarness />);
    await screen.findByText("Slash");
    fireEvent.keyDown(window, { code: "NumpadDivide", key: "/" });
    expect(search).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByLabelText("Draft"), { code: "NumpadDivide", key: "/" });
    expect(search).toHaveBeenCalledTimes(1);
  });
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
