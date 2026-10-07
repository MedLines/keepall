import { describe, expect, test } from "vitest";
import { DEFAULT_SHORTCUTS, assignShortcut, shortcutFromEvent, shortcutMatches, validateShortcuts } from "./keyboard-shortcuts";

describe("app shortcuts", () => {
  test("normalizes physical keys so Option character substitutions still match", () => {
    expect(shortcutMatches({ code: "KeyK", altKey: true }, "Alt+KeyK")).toBe(true);
    expect(shortcutFromEvent({ code: "KeyJ", ctrlKey: true, shiftKey: true })).toBe("Ctrl+Shift+KeyJ");
  });
  test("both slash keys and a slash typed on another layout use the same binding", () => {
    for (const event of [
      { code: "Slash", key: "/" },
      { code: "NumpadDivide", key: "/" },
      { code: "Digit7", key: "/", shiftKey: true },
    ]) {
      expect(shortcutMatches(event, DEFAULT_SHORTCUTS.search)).toBe(true);
      expect(() => assignShortcut(DEFAULT_SHORTCUTS, "capture", shortcutFromEvent(event))).toThrow(/already assigned/);
    }
    expect(shortcutMatches({ code: "NumpadDivide", key: "/", ctrlKey: true }, "Slash")).toBe(false);
    expect(shortcutMatches({ code: "Slash", key: "?", shiftKey: true }, "Slash")).toBe(false);
    expect(shortcutFromEvent({ code: "NumpadDivide", key: "/", altKey: true })).toBe("Alt+Slash");
  });
  test("rejects conflicts, incomplete chords and unknown key codes", () => {
    expect(() => assignShortcut(DEFAULT_SHORTCUTS, "search", "Alt+KeyK")).toThrow(/already assigned/);
    for (const shortcut of ["Ctrl", "Alt+Alt+KeyJ", "KeyAA", "F25", "Unidentified", "Escape", "Tab", "Enter"]) {
      expect(() => assignShortcut(DEFAULT_SHORTCUTS, "search", shortcut)).toThrow();
    }
  });
  test("accepts single keys and chords without requiring Alt", () => {
    for (const shortcut of ["KeyA", "Digit5", "Space", "Period", "F8", "ArrowDown", "Numpad4", "Ctrl+KeyC", "Ctrl+Shift+KeyJ", "Meta+KeyK", "Shift+KeyS", "Alt+Digit5", "Ctrl+Alt+KeyJ", "Ctrl+Enter"]) {
      const next = assignShortcut({ ...DEFAULT_SHORTCUTS, preview: "F9" }, "search", shortcut);
      expect(next.search).toBe(shortcut);
      expect(validateShortcuts(next)).toEqual(next);
    }
  });
  test("allows reassignments and validates backup data", () => {
    const next = assignShortcut(DEFAULT_SHORTCUTS, "capture", "Alt+KeyJ");
    expect(validateShortcuts(next)).toEqual(next);
    expect(shortcutMatches({ code: "KeyK", altKey: true }, next.capture)).toBe(false);
    expect(() => validateShortcuts({ ...next, preview: "Alt+KeyJ" })).toThrow();
    expect(() => validateShortcuts({ capture: "Alt+KeyJ" })).toThrow();
  });
});
