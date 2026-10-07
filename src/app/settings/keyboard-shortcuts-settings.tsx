"use client";

import { useEffect, useState } from "react";
import { assignShortcut, DEFAULT_SHORTCUTS, SHORTCUT_ACTIONS, SHORTCUT_LABELS, shortcutFromEvent, shortcutLabel, type KeyboardShortcuts } from "@/domain/keyboard-shortcuts";
import { getLibraryPreferences, putKeyboardShortcuts } from "@/persistence/library-preferences";
import { SHORTCUTS_CHANGED_EVENT } from "../use-app-shortcuts";

export function KeyboardShortcutsSettings() {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcuts>(DEFAULT_SHORTCUTS);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let disposed = false;
    void getLibraryPreferences().then(preferences => {
      if (!disposed) { setShortcuts(preferences.keyboardShortcuts ?? DEFAULT_SHORTCUTS); setReady(true); }
    }).catch(() => { if (!disposed) setError("Couldn't load shortcut settings. Reload to retry."); });
    return () => { disposed = true; };
  }, []);
  async function save(next: KeyboardShortcuts) {
    setBusy(true); setError(null); setNotice("");
    try {
      await putKeyboardShortcuts(next);
      setShortcuts(next);
      window.dispatchEvent(new Event(SHORTCUTS_CHANGED_EVENT));
      setNotice("Shortcuts saved.");
    } catch { setError("Couldn't save shortcuts. Try again."); }
    finally { setBusy(false); }
  }
  return <section className="library-panel border border-border-control bg-bg-surface p-5 sm:p-6" aria-labelledby="keyboard-shortcuts-heading">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="keyboard-shortcuts-heading" className="text-lg font-semibold text-text-primary">App shortcuts</h2>
      <button type="button" disabled={!ready || busy} className="ui-control min-h-11 px-3 text-sm disabled:opacity-50" onClick={() => void save({ ...DEFAULT_SHORTCUTS })}>Reset to defaults</button>
    </div>
    <p id="shortcut-instructions" className="mt-2 text-sm leading-6 text-text-secondary">Select a shortcut field and press Alt/Option with a letter or number, optionally Shift. You can also use /. Shortcuts pause while typing, editing text, or using a dialog.</p>
    <div className="mt-4 space-y-3">
      {SHORTCUT_ACTIONS.map(action => <div key={action} className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={`shortcut-${action}`} className="text-sm text-text-primary">{SHORTCUT_LABELS[action]}</label>
        <input id={`shortcut-${action}`} className="ui-field h-11 w-44 text-center text-sm" aria-describedby="shortcut-instructions" readOnly disabled={!ready || busy} value={shortcutLabel(shortcuts[action])}
          onKeyDown={event => {
            if (event.key === "Tab" || event.key === "Escape" || ["Alt", "Control", "Meta", "Shift"].includes(event.key) || event.nativeEvent.isComposing) return;
            event.preventDefault(); event.stopPropagation();
            try { void save(assignShortcut(shortcuts, action, shortcutFromEvent(event))); }
            catch (caught) { setNotice(""); setError(caught instanceof Error ? caught.message : "Choose another shortcut."); }
          }} />
      </div>)}
    </div>
    {error ? <p role="alert" className="mt-3 text-sm text-text-danger">{error}</p> : null}
    <p role="status" className="mt-3 text-sm text-text-secondary">{notice}</p>
    <p className="mt-3 text-xs text-text-secondary">Saved on this device and included in library backups. Set the capture extension shortcut separately in Chrome.</p>
  </section>;
}
