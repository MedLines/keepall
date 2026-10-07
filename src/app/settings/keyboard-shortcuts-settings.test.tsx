import { Blob as NodeBlob } from "node:buffer";
import { DEFAULT_SHORTCUTS } from "@/domain/keyboard-shortcuts";
import { exportKeepallArchive, importKeepallArchiveReplace } from "@/persistence/backup-archive";
import { ITEMS_CHANGED_EVENT } from "../items-events";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vitest";
import { getLibraryPreferences, putKeyboardShortcuts } from "@/persistence/library-preferences";
import { KeyboardShortcutsSettings } from "./keyboard-shortcuts-settings";

test("reassigns, rejects conflicts and reserved keys, and resets app shortcuts", async () => {
  render(<KeyboardShortcutsSettings />);
  const capture = screen.getByLabelText("Save item");
  await waitFor(() => expect(capture).toBeEnabled());
  fireEvent.keyDown(capture, { code: "KeyJ", key: "j", altKey: true });
  await waitFor(() => expect(capture).toHaveValue("Alt/Option+J"));
  expect((await getLibraryPreferences()).keyboardShortcuts?.capture).toBe("Alt+KeyJ");
  fireEvent.keyDown(screen.getByLabelText("Focus search"), { code: "KeyJ", key: "j", altKey: true });
  expect(await screen.findByRole("alert")).toHaveTextContent("already assigned");
  fireEvent.keyDown(capture, { code: "KeyD", key: "d", altKey: true });
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("reserved by browsers"));
  fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));
  await waitFor(() => expect(capture).toHaveValue("Alt/Option+K"));
});

test("a ZIP restore refreshes mounted settings and changing one key preserves the restored others", async () => {
  const imported = { ...DEFAULT_SHORTCUTS, capture: "Alt+KeyJ", search: "Alt+KeyM", toggleLayout: "Alt+KeyN", preview: "Alt+KeyO" };
  await putKeyboardShortcuts(imported);
  const source = await exportKeepallArchive();
  const archive = new NodeBlob([new Uint8Array(await source.arrayBuffer())]) as unknown as Blob;
  await putKeyboardShortcuts(DEFAULT_SHORTCUTS);
  render(<KeyboardShortcutsSettings />);
  const capture = screen.getByLabelText("Save item");
  await waitFor(() => expect(capture).toBeEnabled());
  expect(capture).toHaveValue("Alt/Option+K");
  await importKeepallArchiveReplace(archive);
  window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
  await waitFor(() => expect(capture).toHaveValue("Alt/Option+J"));
  expect(screen.getByLabelText("Focus search")).toHaveValue("Alt/Option+M");
  fireEvent.keyDown(capture, { code: "KeyL", key: "l", altKey: true });
  await waitFor(() => expect(capture).toHaveValue("Alt/Option+L"));
  expect((await getLibraryPreferences()).keyboardShortcuts).toEqual({ ...imported, capture: "Alt+KeyL" });
});

test("changing a key merges against stored preferences even before a reload event arrives", async () => {
  render(<KeyboardShortcutsSettings />);
  const capture = screen.getByLabelText("Save item");
  await waitFor(() => expect(capture).toBeEnabled());
  await putKeyboardShortcuts({ ...DEFAULT_SHORTCUTS, search: "Alt+KeyM" });
  fireEvent.keyDown(capture, { code: "KeyL", key: "l", altKey: true });
  await waitFor(() => expect(capture).toHaveValue("Alt/Option+L"));
  expect((await getLibraryPreferences()).keyboardShortcuts?.search).toBe("Alt+KeyM");
});
