export const SHORTCUT_ACTIONS = ["capture", "search", "toggleLayout", "preview"] as const;
export type ShortcutAction = typeof SHORTCUT_ACTIONS[number];
export type KeyboardShortcuts = Record<ShortcutAction, string>;
export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  capture: "Save item", search: "Focus search", toggleLayout: "Toggle grid / list", preview: "Preview results",
};
export const DEFAULT_SHORTCUTS: KeyboardShortcuts = {
  capture: "Alt+KeyK", search: "Slash", toggleLayout: "Alt+KeyG", preview: "Alt+KeyP",
};
type KeyEvent = { code: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean };

export function shortcutFromEvent(event: KeyEvent): string {
  return [event.ctrlKey && "Ctrl", event.metaKey && "Meta", event.altKey && "Alt", event.shiftKey && "Shift", event.code].filter(Boolean).join("+");
}

export function shortcutMatches(event: KeyEvent, shortcut: string): boolean {
  return shortcutFromEvent(event) === shortcut;
}

export function shortcutLabel(shortcut: string): string {
  return shortcut.replace(/Key([A-Z])/g, "$1").replace(/Digit(\d)/g, "$1").replace("Slash", "/").replace("Meta", "Cmd").replace("Alt", "Alt/Option");
}

function assertShortcut(shortcut: unknown): asserts shortcut is string {
  if (typeof shortcut === "string" && /^Alt\+(Key[DEFBHTV]|Digit[0-9])$/.test(shortcut)) {
    throw new Error(`${shortcutLabel(shortcut)} is reserved by browsers. Choose another shortcut.`);
  }
  if (typeof shortcut !== "string" || (shortcut !== "Slash" && !/^Alt\+(Shift\+)?(Key[A-Z]|Digit[0-9]|Slash)$/.test(shortcut))) {
    throw new Error("Use Alt/Option with a letter or number, optionally Shift, or / without modifiers. Browser and text editing shortcuts are reserved.");
  }
}

export function validateShortcuts(raw: unknown): KeyboardShortcuts {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid app shortcuts");
  const candidate = raw as Record<string, unknown>;
  const result = { ...DEFAULT_SHORTCUTS };
  const assigned = new Set<string>();
  for (const action of SHORTCUT_ACTIONS) {
    const shortcut = candidate[action];
    assertShortcut(shortcut);
    if (assigned.has(shortcut)) throw new Error(`${shortcutLabel(shortcut)} is already assigned to another action.`);
    assigned.add(shortcut);
    result[action] = shortcut;
  }
  return result;
}

export function assignShortcut(current: KeyboardShortcuts, action: ShortcutAction, shortcut: string): KeyboardShortcuts {
  return validateShortcuts({ ...current, [action]: shortcut });
}
