import { describe, expect, test } from "vitest";
import { DEFAULT_SHORTCUTS, assignShortcut, shortcutFromEvent, shortcutMatches, validateShortcuts } from "./keyboard-shortcuts";

describe("app shortcuts", () => {
  test("normalizes physical keys so Option character substitutions still match", () => {
    expect(shortcutMatches({ code: "KeyK", altKey: true }, "Alt+KeyK")).toBe(true);
    expect(shortcutFromEvent({ code: "KeyJ", ctrlKey: true, shiftKey: true })).toBe("Ctrl+Shift+KeyJ");
  });
  test("rejects conflicts and browser or editing combinations", () => {
    expect(() => assignShortcut(DEFAULT_SHORTCUTS, "search", "Alt+KeyK")).toThrow(/already assigned/);
    expect(() => assignShortcut(DEFAULT_SHORTCUTS, "search", "Ctrl+KeyC")).toThrow();
    expect(() => assignShortcut(DEFAULT_SHORTCUTS, "search", "KeyA")).toThrow();
    expect(() => assignShortcut(DEFAULT_SHORTCUTS, "search", "Space")).toThrow();
    for (const code of ["KeyD", "KeyF", "KeyE", "KeyV", "Digit1"]) expect(() => assignShortcut(DEFAULT_SHORTCUTS, "search", `Alt+${code}`)).toThrow(/reserved/);
  });
  test("allows reassignments and validates backup data", () => {
    const next = assignShortcut(DEFAULT_SHORTCUTS, "capture", "Alt+KeyJ");
    expect(validateShortcuts(next)).toEqual(next);
    expect(shortcutMatches({ code: "KeyK", altKey: true }, next.capture)).toBe(false);
    expect(() => validateShortcuts({ ...next, preview: "Alt+KeyJ" })).toThrow();
    expect(() => validateShortcuts({ capture: "Alt+KeyJ" })).toThrow();
  });
});
