import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vitest";
import { getLibraryPreferences } from "@/persistence/library-preferences";
import { KeyboardShortcutsSettings } from "./keyboard-shortcuts-settings";

test("reassigns, rejects conflicts and reserved keys, and resets app shortcuts", async () => {
  render(<KeyboardShortcutsSettings />);
  const capture = screen.getByLabelText("Save item");
  await waitFor(() => expect(capture).toBeEnabled());
  fireEvent.keyDown(capture, { code: "KeyJ", key: "j", altKey: true });
  await waitFor(() => expect(capture).toHaveValue("Alt/Option+J"));
  expect((await getLibraryPreferences()).keyboardShortcuts?.capture).toBe("Alt+KeyJ");
  fireEvent.keyDown(screen.getByLabelText("Focus search"), { code: "KeyJ", key: "j", altKey: true });
  expect(screen.getByRole("alert")).toHaveTextContent("already assigned");
  fireEvent.keyDown(capture, { code: "KeyD", key: "d", altKey: true });
  expect(screen.getByRole("alert")).toHaveTextContent("reserved by browsers");
  fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));
  await waitFor(() => expect(capture).toHaveValue("Alt/Option+K"));
});
