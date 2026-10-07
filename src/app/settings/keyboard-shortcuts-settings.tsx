"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ShortcutValidationError, DEFAULT_SHORTCUTS, SHORTCUT_ACTIONS, SHORTCUT_LABELS, assignShortcut, shortcutFromEvent, shortcutLabel, type KeyboardShortcuts, type ShortcutAction } from "@/domain/keyboard-shortcuts";
import { getLibraryPreferences, putKeyboardShortcut, putKeyboardShortcuts } from "@/persistence/library-preferences";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { ITEMS_CHANGED_EVENT } from "../items-events";
import { SHORTCUTS_CHANGED_EVENT } from "../use-app-shortcuts";

const CONTROL = "ui-control inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-medium disabled:opacity-50";
const MODIFIER_KEYS = ["Alt", "Control", "Meta", "Shift"];

function hasModifiers(event: KeyboardEvent<HTMLElement>) {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

function modifierLabel(event: KeyboardEvent<HTMLElement>) {
  return shortcutLabel([event.ctrlKey && "Ctrl", event.metaKey && "Meta", event.altKey && "Alt", event.shiftKey && "Shift"].filter(Boolean).join("+"));
}

function isButtonActivation(event: KeyboardEvent<HTMLElement>) {
  return !hasModifiers(event) && ["Enter", " "].includes(event.key) && (event.target as HTMLElement).closest("button");
}

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
    <p className="mt-2 text-sm leading-6 text-text-secondary">Choose Change, press the keys together, then confirm. Shortcuts pause while typing or using a dialog.</p>
    <div className="mt-4 divide-y divide-border-control">
      {SHORTCUT_ACTIONS.map(action => (
        <div key={action} role="group" aria-label={`Shortcut for ${SHORTCUT_LABELS[action]}`} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-text-primary">{SHORTCUT_LABELS[action]}</p>
            <div className="flex flex-wrap items-center gap-2">
              <kbd className="min-w-28 text-center text-sm font-normal text-text-secondary">{shortcutLabel(shortcuts[action])}</kbd>
              <button ref={node => { if (node) changeButtons.current[action] = node; }} type="button" className={CONTROL} aria-label={`Change ${SHORTCUT_LABELS[action]} shortcut`} disabled={!ready || busy || editing !== null} onClick={() => { setEditing(action); setError(null); setNotice(""); }}>Change</button>
            </div>
          </div>
        </div>
      ))}
    </div>
    {editing ? <ShortcutRecorder action={editing} shortcuts={shortcuts} busy={busy} saveError={error} onSave={candidate => void saveShortcut(editing, candidate)} onCancel={() => { setError(null); setNotice("Change cancelled."); finishEditing(editing); }} /> : null}
    {error && !editing ? <p role="alert" className="mt-3 text-sm text-text-danger">{error}</p> : null}
    {notice ? <p role="status" className="mt-3 text-sm text-text-secondary">{notice}</p> : null}
    <p className="mt-4 text-xs leading-5 text-text-secondary">These shortcuts work inside Keepall and are included in library backups. The Chrome capture extension has its own shortcut. <Link href="/help/chrome-capture" className="underline underline-offset-4">Change the Chrome extension shortcut</Link>.</p>
  </section>;
}

function ShortcutRecorder({ action, shortcuts, busy, saveError, onSave, onCancel }: {
  action: ShortcutAction;
  shortcuts: KeyboardShortcuts;
  busy: boolean;
  saveError: string | null;
  onSave: (candidate: string) => void;
  onCancel: () => void;
}) {
  const [candidate, setCandidate] = useState<string | null>(null);
  const [attempted, setAttempted] = useState("");
  const [liveModifiers, setLiveModifiers] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const instructionsId = useId();
  const errorId = useId();
  const error = validationError ?? saveError;
  const canConfirm = candidate !== null && liveModifiers === null && !busy;

  function chooseShortcut(next: string) {
    setAttempted(shortcutLabel(next)); setLiveModifiers(null);
    try {
      assignShortcut(shortcuts, action, next);
      setCandidate(next); setValidationError(null);
    } catch (caught) {
      setCandidate(null);
      setValidationError(caught instanceof ShortcutValidationError ? caught.message : "Couldn't record this shortcut. Try again.");
    }
  }

  function record(event: KeyboardEvent<HTMLElement>) {
    if (busy || event.repeat || event.nativeEvent.isComposing || event.key === "Tab" || event.key === "Escape") return;
    if (isButtonActivation(event)) return;
    event.preventDefault(); event.stopPropagation();
    if (MODIFIER_KEYS.includes(event.key)) {
      setLiveModifiers(modifierLabel(event));
      return;
    }
    if (event.key === "Enter" && !hasModifiers(event)) { if (canConfirm && candidate) onSave(candidate); return; }
    chooseShortcut(shortcutFromEvent(event));
  }

  return <ModalDialog open busy={busy} initialFocus={input}
    title={`Change ${SHORTCUT_LABELS[action]} shortcut`}
    description="Press the keys together. Review the new shortcut, then confirm."
    closeLabel="Cancel shortcut change"
    onOpenChange={open => { if (!open) onCancel(); }}
    onKeyDown={record}
    onKeyUp={event => { if (liveModifiers !== null) setLiveModifiers(modifierLabel(event) || null); }}
    footer={<>
      <button type="button" className={CONTROL} disabled={busy} onClick={onCancel}>Cancel</button>
      <button type="button" className={`${CONTROL} bg-bg-active text-text-primary`} disabled={!canConfirm} onClick={() => { if (canConfirm && candidate) onSave(candidate); }}>{busy ? "Saving…" : "Confirm shortcut"}</button>
    </>}
  >
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-2">
        <p className="text-sm font-medium text-text-primary">Current shortcut</p>
        <kbd className="block text-sm font-normal text-text-secondary">{shortcutLabel(shortcuts[action])}</kbd>
      </div>
      <button type="button" className={CONTROL} disabled={busy} onClick={() => { chooseShortcut(DEFAULT_SHORTCUTS[action]); input.current?.focus(); }}>Use default ({shortcutLabel(DEFAULT_SHORTCUTS[action])})</button>
    </div>
    <div className="space-y-2" data-shortcut-recording="">
      <label htmlFor={inputId} className="block text-sm font-medium text-text-primary">New shortcut</label>
      <input id={inputId} ref={input} className="ui-field min-h-12 w-full px-3 text-base" aria-label={`New shortcut for ${SHORTCUT_LABELS[action]}`} aria-describedby={`${instructionsId}${error ? ` ${errorId}` : ""}`} aria-invalid={error ? true : undefined} placeholder="Press a shortcut" readOnly disabled={busy} value={liveModifiers ?? attempted} />
      <p id={instructionsId} className="text-xs leading-5 text-text-secondary">Use a single key or a combination with Ctrl, Shift, Alt or Cmd / Windows. Function keys work too. Both / keys work. Use default selects the original shortcut.</p>
      {error ? <p id={errorId} role="alert" className="text-sm leading-5 text-text-danger">{error}</p> : null}
      <p className="text-xs text-text-secondary">{canConfirm ? "Enter to confirm · Esc to cancel" : "Esc to cancel"}</p>
    </div>
  </ModalDialog>;
}
