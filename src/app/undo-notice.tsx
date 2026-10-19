"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "./shell-icons";

/** How long an undo offer stays on screen before it withdraws on its own. */
export const UNDO_NOTICE_TIMEOUT_MS = 6000;

const TICK_MS = 100;

type Props = {
  /** Sentence the notice states, for example `Moved “Fix this” to Trash.` */
  message: string;
  /** Accessible name of the undo button, naming what is restored. */
  undoLabel: string;
  /** A write is in flight; both actions wait. */
  busy: boolean;
  /** Hold the notice open, for example after a failed undo that needs a retry. */
  paused?: boolean;
  onUndo: () => void;
  onDismiss: () => void;
};

/**
 * Transient undo offer that lives in the top bar's action slot, so announcing a
 * move to Trash never pushes the library down. The countdown pauses while the
 * notice is hovered, focused, busy, or the page is hidden, and the notice never
 * withdraws itself while the keyboard is inside it.
 */
export function UndoNotice({ message, undoLabel, busy, paused = false, onUndo, onDismiss }: Props) {
  const [remaining, setRemaining] = useState(UNDO_NOTICE_TIMEOUT_MS);
  const [held, setHeld] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const remainingRef = useRef(UNDO_NOTICE_TIMEOUT_MS);
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const update = () => setPageHidden(document.visibilityState === "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const waiting = busy || paused || held || pageHidden;

  useEffect(() => {
    if (waiting) return;
    const timer = window.setInterval(() => {
      remainingRef.current = Math.max(0, remainingRef.current - TICK_MS);
      setRemaining(remainingRef.current);
      if (remainingRef.current === 0) dismissRef.current();
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [waiting]);

  return (
    <div
      className="undo-notice control-squircle relative flex h-10 min-w-0 max-w-full items-center gap-1.5 border border-border-control bg-bg-control p-0.5 ps-3 text-xs"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld(false);
      }}
    >
      <p className="min-w-0 truncate text-text-secondary" role="status">{message}</p>
      <button
        type="button"
        className="inline-flex h-8 shrink-0 items-center px-2.5 font-medium text-text-primary hover:bg-bg-raised disabled:opacity-50"
        aria-label={undoLabel}
        disabled={busy}
        onClick={onUndo}
      >
        Undo
      </button>
      <button
        type="button"
        className="inline-flex size-8 shrink-0 items-center justify-center text-text-secondary hover:bg-bg-raised hover:text-text-primary"
        aria-label="Dismiss Trash notice"
        title="Dismiss"
        onClick={onDismiss}
      >
        <CloseIcon className="size-4" />
      </button>
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-3 bottom-0 h-0.5 overflow-hidden rounded-full bg-bg-raised motion-reduce:hidden">
        <span
          className="undo-notice-timer block h-full bg-text-secondary"
          style={{ transform: `scaleX(${remaining / UNDO_NOTICE_TIMEOUT_MS})` }}
        />
      </span>
    </div>
  );
}
