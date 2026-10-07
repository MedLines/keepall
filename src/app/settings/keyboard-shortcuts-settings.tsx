"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ShortcutValidationError, DEFAULT_SHORTCUTS, SHORTCUT_ACTIONS, SHORTCUT_LABELS, assignShortcut, shortcutFromEvent, shortcutLabel, type KeyboardShortcuts, type ShortcutAction } from "@/domain/keyboard-shortcuts";
import { getLibraryPreferences, putKeyboardShortcut, putKeyboardShortcuts } from "@/persistence/library-preferences";
import { ITEMS_CHANGED_EVENT } from "../items-events";
import { SHORTCUTS_CHANGED_EVENT } from "../use-app-shortcuts";

const CONTROL = "ui-control inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-medium disabled:opacity-50";

export function KeyboardShortcutsSettings() {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcuts>(DEFAULT_SHORTCUTS);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ShortcutAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const changeButtons = useRef<Partial<Record<ShortcutAction, HTMLButtonElement>>>({});
  const returnFocus = useRef<ShortcutAction | null>(null);

  useEffect(() => {
    let disposed = false;
    let generation = 0;
    const reload = () => {
      const request = ++generation;
      void getLibraryPreferences().then(preferences => {
        if (!disposed && request === generation) { setShortcuts(preferences.keyboardShortcuts ?? DEFAULT_SHORTCUTS); setReady(true); setError(null); }
      }).catch(() => { if (!disposed && request === generation) setError("Couldn't load shortcut settings. Reload to retry."); });
    };
    reload();
    window.addEventListener(ITEMS_CHANGED_EVENT, reload);
    window.addEventListener(SHORTCUTS_CHANGED_EVENT, reload);
    window.addEventListener("focus", reload);
    return () => {
      disposed = true;
      window.removeEventListener(ITEMS_CHANGED_EVENT, reload);
      window.removeEventListener(SHORTCUTS_CHANGED_EVENT, reload);
      window.removeEventListener("focus", reload);
    };
  }, []);

  useEffect(() => {
    if (!editing && returnFocus.current) {
      changeButtons.current[returnFocus.current]?.focus();
      returnFocus.current = null;
    }
  }, [editing]);

  async function save(write: () => Promise<KeyboardShortcuts>, savedNotice: string) {
    setBusy(true); setError(null); setNotice("");
    try {
      const next = await write();
      setShortcuts(next);
      window.dispatchEvent(new Event(SHORTCUTS_CHANGED_EVENT));
      setNotice(savedNotice);
      return true;
    } catch (caught) {
      setError(caught instanceof ShortcutValidationError ? caught.message : "Couldn't save shortcuts. Try again.");
      return false;
    } finally { setBusy(false); }
  }

  function finishEditing(action: ShortcutAction) {
    returnFocus.current = action;
    setEditing(null);
  }

  async function saveShortcut(action: ShortcutAction, candidate: string) {
    const saved = await save(() => putKeyboardShortcut(action, candidate), `${SHORTCUT_LABELS[action]} shortcut saved.`);
    if (saved) finishEditing(action);
  }

  return <section className="library-panel border border-border-control bg-bg-surface p-5 sm:p-6" aria-labelledby="keyboard-shortcuts-heading">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="keyboard-shortcuts-heading" className="text-lg font-semibold text-text-primary">App shortcuts</h2>
      <button type="button" disabled={!ready || busy || editing !== null} className={CONTROL} onClick={() => void save(async () => { await putKeyboardShortcuts(DEFAULT_SHORTCUTS); return { ...DEFAULT_SHORTCUTS }; }, "Shortcuts reset to defaults.")}>Reset to defaults</button>
    </div>
    <p className="mt-2 text-sm leading-6 text-text-secondary">Choose Change, press the keys together, then Save. Shortcuts pause while typing or using a dialog.</p>
    <div className="mt-4 divide-y divide-border-control">
      {SHORTCUT_ACTIONS.map(action => (
        <div key={action} role="group" aria-label={`Shortcut for ${SHORTCUT_LABELS[action]}`} className="py-3 first:pt-0 last:pb-0" data-shortcut-recording={editing === action ? "" : undefined}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-text-primary">{SHORTCUT_LABELS[action]}</p>
            <div className="flex flex-wrap items-center gap-2">
              <kbd className="min-w-28 text-center text-sm font-normal text-text-secondary">{shortcutLabel(shortcuts[action])}</kbd>
              {editing !== action ? <button ref={node => { if (node) changeButtons.current[action] = node; }} type="button" className={CONTROL} aria-label={`Change ${SHORTCUT_LABELS[action]} shortcut`} disabled={!ready || busy || editing !== null} onClick={() => { setEditing(action); setError(null); setNotice(""); }}>Change</button> : null}
            </div>
          </div>
          {editing === action ? <ShortcutRecorder action={action} shortcuts={shortcuts} busy={busy} onSave={candidate => void saveShortcut(action, candidate)} onCancel={() => { setError(null); setNotice("Change cancelled."); finishEditing(action); }} /> : null}
        </div>
      ))}
    </div>
    {error ? <p role="alert" className="mt-3 text-sm text-text-danger">{error}</p> : null}
    {notice ? <p role="status" className="mt-3 text-sm text-text-secondary">{notice}</p> : null}
    <p className="mt-4 text-xs leading-5 text-text-secondary">These shortcuts work inside Keepall and are included in library backups. The Chrome capture extension has its own shortcut. <Link href="/help/chrome-capture" className="underline underline-offset-4">Change the Chrome extension shortcut</Link>.</p>
  </section>;
}

function ShortcutRecorder({ action, shortcuts, busy, onSave, onCancel }: {
  action: ShortcutAction;
  shortcuts: KeyboardShortcuts;
  busy: boolean;
  onSave: (candidate: string) => void;
  onCancel: () => void;
}) {
  const [candidate, setCandidate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const instructionsId = useId();
  const errorId = useId();
  useEffect(() => { input.current?.focus(); }, []);

  function record(event: KeyboardEvent<HTMLInputElement>) {
    if (event.repeat || event.nativeEvent.isComposing || event.key === "Tab" || ["Alt", "Control", "Meta", "Shift"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === "Escape") { onCancel(); return; }
    if (event.key === "Enter" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && candidate) { onSave(candidate); return; }
    try {
      const next = shortcutFromEvent(event);
      assignShortcut(shortcuts, action, next);
      setCandidate(next); setError(null);
    } catch (caught) {
      setCandidate(null);
      setError(caught instanceof ShortcutValidationError ? caught.message : "Couldn't record this shortcut. Try again.");
    }
  }

  return <div className="mt-3 space-y-3">
    <p id={instructionsId} className="text-xs leading-5 text-text-secondary">Press Alt/Option with a letter, optionally Shift. Numbers need Alt/Option+Shift. You can also use /.</p>
    <input ref={input} className="ui-field min-h-11 w-full px-3 text-sm" aria-label={`New shortcut for ${SHORTCUT_LABELS[action]}`} aria-describedby={`${instructionsId}${error ? ` ${errorId}` : ""}`} aria-invalid={error ? true : undefined} placeholder="Press a shortcut" readOnly disabled={busy} value={candidate ? shortcutLabel(candidate) : ""} onKeyDown={record} />
    {error ? <p id={errorId} role="alert" className="text-xs leading-5 text-text-danger">{error}</p> : null}
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={CONTROL} disabled={!candidate || busy} onClick={() => { if (candidate) onSave(candidate); }}>{busy ? "Saving…" : "Save shortcut"}</button>
      <button type="button" className={CONTROL} disabled={busy} onClick={onCancel}>Cancel</button>
      <span className="text-xs text-text-secondary">{candidate ? "Enter to save · Esc to cancel" : "Esc to cancel"}</span>
    </div>
  </div>;
}
