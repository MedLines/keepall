export const SHORTCUT_ACTIONS = ["capture", "search", "toggleLayout", "preview"] as const;
export type ShortcutAction = typeof SHORTCUT_ACTIONS[number];
export type KeyboardShortcuts = Record<ShortcutAction, string>;
export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  capture: "Save item", search: "Focus search", toggleLayout: "Toggle grid / list", preview: "Preview results",
};
export const DEFAULT_SHORTCUTS: KeyboardShortcuts = {
  capture: "Alt+KeyK", search: "Slash", toggleLayout: "Alt+KeyG", preview: "Space",
};
type KeyEvent = { code: string; key?: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean };

export function shortcutFromEvent(event: KeyEvent): string {
  if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) return "Slash";
  const code = event.code === "NumpadDivide" ? "Slash" : event.code;
  return [event.ctrlKey && "Ctrl", event.metaKey && "Meta", event.altKey && "Alt", event.shiftKey && "Shift", code].filter(Boolean).join("+");
}

export function shortcutMatches(event: KeyEvent, shortcut: string): boolean {
  return shortcutFromEvent(event) === shortcut;
}

export function shortcutLabel(shortcut: string): string {
  const keyLabels: Record<string, string> = {
    Slash: "/", Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Backslash: "\\", Semicolon: ";", Quote: "'", Comma: ",", Period: ".",
    ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right", PageUp: "Page Up", PageDown: "Page Down",
    Meta: "Cmd / Windows", Alt: "Alt/Option", NumpadAdd: "Numpad +", NumpadSubtract: "Numpad -", NumpadMultiply: "Numpad *", NumpadDecimal: "Numpad .", NumpadEnter: "Numpad Enter", NumpadEqual: "Numpad =",
  };
  return shortcut.split("+").map(part => keyLabels[part] ?? part.replace(/^Key([A-Z])$/, "$1").replace(/^Digit(\d)$/, "$1").replace(/^Numpad(\d)$/, "Numpad $1")).join("+");
}

export class ShortcutValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShortcutValidationError";
  }
}

function assertShortcut(shortcut: unknown): asserts shortcut is string {
  const pattern = /^(Ctrl\+)?(Meta\+)?(Alt\+)?(Shift\+)?(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-9]|2[0-4])|Numpad([0-9]|Add|Subtract|Multiply|Decimal|Enter|Equal)|Arrow(Up|Down|Left|Right)|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|IntlBackslash|IntlRo|IntlYen|Semicolon|Quote|Comma|Period|Slash|Space|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Enter)$/;
  if (typeof shortcut !== "string" || !pattern.test(shortcut) || shortcut === "Enter") {
    throw new ShortcutValidationError("Press a key, with or without Ctrl, Shift, Alt or Cmd. Escape cancels, Tab moves focus, and Enter confirms.");
  }
}

export function validateShortcuts(raw: unknown): KeyboardShortcuts {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ShortcutValidationError("Invalid app shortcuts");
  const candidate = raw as Record<string, unknown>;
  const result = { ...DEFAULT_SHORTCUTS };
  const assigned = new Set<string>();
  for (const action of SHORTCUT_ACTIONS) {
    const shortcut = candidate[action];
    assertShortcut(shortcut);
    if (assigned.has(shortcut)) throw new ShortcutValidationError(`${shortcutLabel(shortcut)} is already assigned to another action.`);
    assigned.add(shortcut);
    result[action] = shortcut;
  }
  return result;
}

export function assignShortcut(current: KeyboardShortcuts, action: ShortcutAction, shortcut: string): KeyboardShortcuts {
  return validateShortcuts({ ...current, [action]: shortcut });
}
