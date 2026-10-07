"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { DEFAULT_SHORTCUTS, SHORTCUT_ACTIONS, shortcutMatches, type KeyboardShortcuts, type ShortcutAction } from "@/domain/keyboard-shortcuts";
import { getLibraryPreferences } from "@/persistence/library-preferences";
import { ITEMS_CHANGED_EVENT } from "./items-events";

export const SHORTCUTS_CHANGED_EVENT = "keepall:shortcuts-changed";

export function isShortcutEditingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [role="textbox"], [role="combobox"], [contenteditable]:not([contenteditable="false"])'));
}

export function useAppShortcuts(actions: Partial<Record<ShortcutAction, () => void>>, enabled = true): KeyboardShortcuts {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcuts>(DEFAULT_SHORTCUTS);
  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    if (!enabled || event.defaultPrevented || event.repeat || event.isComposing || isShortcutEditingTarget(event.target) || document.querySelector('[role="dialog"]:not([data-ending-style]), [role="alertdialog"]:not([data-ending-style]), [data-shortcut-recording]')) return;
    if (event.key === " " && !event.ctrlKey && !event.metaKey && !event.altKey && event.target instanceof Element && !event.target.hasAttribute("data-item-id") && event.target.closest('button, a[href], [role="button"], [role="menuitem"]')) return;
    for (const action of SHORTCUT_ACTIONS) {
      if (actions[action] && shortcutMatches(event, shortcuts[action])) {
        event.preventDefault();
        actions[action]();
        break;
      }
    }
  });
  useEffect(() => {
    let disposed = false;
    const reload = () => {
      void getLibraryPreferences().then(preferences => {
        if (!disposed) setShortcuts(preferences.keyboardShortcuts ?? DEFAULT_SHORTCUTS);
      }).catch(() => { /* defaults remain usable when storage is unavailable */ });
    };
    reload();
    window.addEventListener(SHORTCUTS_CHANGED_EVENT, reload);
    window.addEventListener(ITEMS_CHANGED_EVENT, reload);
    window.addEventListener("keydown", handleKey, true);
    return () => {
      disposed = true;
      window.removeEventListener(SHORTCUTS_CHANGED_EVENT, reload);
      window.removeEventListener(ITEMS_CHANGED_EVENT, reload);
      window.removeEventListener("keydown", handleKey, true);
    };
  }, []);
  return shortcuts;
}
