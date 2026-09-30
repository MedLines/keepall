"use client";

import { type FocusEvent, useRef, useState } from "react";

export function useDirtyDismissal(dirty: boolean, dismiss: () => void) {
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement>(null);

  function rememberFocus(event: FocusEvent<HTMLElement>) {
    const target = event.target;
    if (target.matches("input, textarea, select, [contenteditable=true]")) {
      returnFocusRef.current = target;
    }
  }

  function requestDismiss(details: { cancel: () => void }) {
    if (!dirty) { dismiss(); return; }
    details.cancel();
    setConfirming(true);
  }

  return {
    requestDismiss,
    rememberFocus,
    confirmationProps: {
      open: confirming,
      title: "Discard unsaved changes?",
      description: "Your changes will be lost if you discard them.",
      confirmLabel: "Discard changes",
      cancelLabel: "Keep editing",
      cancelRef,
      returnFocusRef,
      onOpenChange: setConfirming,
      onConfirm: () => { setConfirming(false); dismiss(); },
    },
  };
}
