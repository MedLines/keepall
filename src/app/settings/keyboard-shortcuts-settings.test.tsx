import { Blob as NodeBlob } from "node:buffer";
import { DEFAULT_SHORTCUTS } from "@/domain/keyboard-shortcuts";
import { exportKeepallArchive, importKeepallArchiveReplace } from "@/persistence/backup-archive";
import { ITEMS_CHANGED_EVENT } from "../items-events";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { getLibraryPreferences, putKeyboardShortcuts } from "@/persistence/library-preferences";
import { KeyboardShortcutsSettings } from "./keyboard-shortcuts-settings";

async function startRecording(label: string) {
  const change = screen.getByRole("button", { name: `Change ${label} shortcut` });
  await waitFor(() => expect(change).toBeEnabled());
  fireEvent.click(change);
  return screen.getByRole("textbox", { name: `New shortcut for ${label}` });
}

function binding(label: string, value: string) {
  return within(screen.getByRole("group", { name: `Shortcut for ${label}` })).getByText(value);
}

test("records a shortcut only after Change and saves it explicitly", async () => {
  render(<KeyboardShortcutsSettings />);
  const recorder = await startRecording("Save item");
  expect(recorder).toHaveFocus();
  fireEvent.keyDown(recorder, { code: "KeyJ", key: "j", altKey: true });
  expect(recorder).toHaveValue("Alt/Option+J");
  expect((await getLibraryPreferences()).keyboardShortcuts?.capture ?? DEFAULT_SHORTCUTS.capture).toBe("Alt+KeyK");
  fireEvent.click(screen.getByRole("button", { name: "Save shortcut" }));
  await waitFor(() => expect(binding("Save item", "Alt/Option+J")).toBeVisible());
  expect((await getLibraryPreferences()).keyboardShortcuts?.capture).toBe("Alt+KeyJ");
  expect(screen.getByRole("button", { name: "Change Save item shortcut" })).toHaveFocus();
  expect(screen.getByRole("status")).toHaveTextContent("Save item shortcut saved.");
});

test("Cancel and Escape discard recorded keys and restore Change focus", async () => {
  render(<KeyboardShortcutsSettings />);
  for (const cancel of ["button", "Escape", "Escape from Save", "Escape from Cancel"]) {
    const recorder = await startRecording("Save item");
    fireEvent.keyDown(recorder, { code: "KeyJ", key: "j", altKey: true });
    if (cancel === "button") fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    else if (cancel === "Escape from Save" || cancel === "Escape from Cancel") {
      const button = screen.getByRole("button", { name: cancel === "Escape from Save" ? "Save shortcut" : "Cancel" });
      button.focus();
      fireEvent.keyDown(button, { code: "Escape", key: "Escape" });
    }
    else fireEvent.keyDown(recorder, { code: "Escape", key: "Escape" });
    expect(binding("Save item", "Alt/Option+K")).toBeVisible();
    expect(screen.getByRole("button", { name: "Change Save item shortcut" })).toHaveFocus();
    expect((await getLibraryPreferences()).keyboardShortcuts?.capture ?? DEFAULT_SHORTCUTS.capture).toBe("Alt+KeyK");
  }
});

test("rejects unsupported keys, browser reservations and conflicts before saving", async () => {
  render(<KeyboardShortcutsSettings />);
  const recorder = await startRecording("Save item");
  fireEvent.keyDown(recorder, { code: "KeyJ", key: "j", ctrlKey: true });
  expect(screen.getByRole("alert")).toHaveTextContent("Use Alt/Option");
  fireEvent.keyDown(recorder, { code: "KeyD", key: "d", altKey: true });
  expect(screen.getByRole("alert")).toHaveTextContent("reserved by browsers");
  fireEvent.keyDown(recorder, { code: "KeyG", key: "g", altKey: true });
  expect(screen.getByRole("alert")).toHaveTextContent("already assigned");
  expect(screen.getByRole("button", { name: "Save shortcut" })).toBeDisabled();
  expect(recorder).toHaveAttribute("aria-invalid", "true");
  fireEvent.keyDown(recorder, { code: "KeyJ", key: "j", altKey: true });
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.keyDown(recorder, { code: "Enter", key: "Enter" });
  await waitFor(() => expect(binding("Save item", "Alt/Option+J")).toBeVisible());
  fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));
  await waitFor(() => expect(binding("Save item", "Alt/Option+K")).toBeVisible());
});

test("explains that number shortcuts need Shift and records supported physical keys", async () => {
  render(<KeyboardShortcutsSettings />);
  const recorder = await startRecording("Save item");
  expect(screen.getByText(/Numbers need Alt\/Option\+Shift/)).toBeVisible();
  fireEvent.keyDown(recorder, { code: "Digit5", key: "5", altKey: true });
  expect(screen.getByRole("alert")).toHaveTextContent("reserved by browsers");
  fireEvent.keyDown(recorder, { code: "Digit5", key: "%", altKey: true, shiftKey: true });
  expect(recorder).toHaveValue("Alt/Option+Shift+5");
  fireEvent.click(screen.getByRole("button", { name: "Save shortcut" }));
  await waitFor(() => expect(binding("Save item", "Alt/Option+Shift+5")).toBeVisible());
  expect((await getLibraryPreferences()).keyboardShortcuts?.capture).toBe("Alt+Shift+Digit5");
});

test("a ZIP restore refreshes mounted settings and changing one key preserves the restored others", async () => {
  const imported = { ...DEFAULT_SHORTCUTS, capture: "Alt+KeyJ", search: "Alt+KeyM", toggleLayout: "Alt+KeyN", preview: "Alt+KeyO" };
  await putKeyboardShortcuts(imported);
  const source = await exportKeepallArchive();
  const archive = new NodeBlob([new Uint8Array(await source.arrayBuffer())]) as unknown as Blob;
  await putKeyboardShortcuts(DEFAULT_SHORTCUTS);
  render(<KeyboardShortcutsSettings />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Change Save item shortcut" })).toBeEnabled());
  expect(binding("Save item", "Alt/Option+K")).toBeVisible();
  await importKeepallArchiveReplace(archive);
  window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
  await waitFor(() => expect(binding("Save item", "Alt/Option+J")).toBeVisible());
  expect(binding("Focus search", "Alt/Option+M")).toBeVisible();
  const recorder = await startRecording("Save item");
  fireEvent.keyDown(recorder, { code: "KeyL", key: "l", altKey: true });
  fireEvent.click(screen.getByRole("button", { name: "Save shortcut" }));
  await waitFor(() => expect(binding("Save item", "Alt/Option+L")).toBeVisible());
  expect((await getLibraryPreferences()).keyboardShortcuts).toEqual({ ...imported, capture: "Alt+KeyL" });
});

test("changing a key merges against stored preferences even before a reload event arrives", async () => {
  render(<KeyboardShortcutsSettings />);
  const recorder = await startRecording("Save item");
  await putKeyboardShortcuts({ ...DEFAULT_SHORTCUTS, search: "Alt+KeyM" });
  fireEvent.keyDown(recorder, { code: "KeyL", key: "l", altKey: true });
  fireEvent.click(screen.getByRole("button", { name: "Save shortcut" }));
  await waitFor(() => expect(binding("Save item", "Alt/Option+L")).toBeVisible());
  expect((await getLibraryPreferences()).keyboardShortcuts?.search).toBe("Alt+KeyM");
});
