"use client";

import { type FocusEvent, useRef, useState } from "react";
import { useTranslations } from "@/i18n/use-translations";

export function useDirtyDismissal(dirty: boolean, dismiss: () => void) {
  const [confirming, setConfirming] = useState(false);
  const t = useTranslations("DirtyDismissal");
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
      title: t("title"),
      description: t("description"),
      confirmLabel: t("confirm"),
      cancelLabel: t("cancel"),
      cancelRef,
      returnFocusRef,
      onOpenChange: setConfirming,
      onConfirm: () => { setConfirming(false); dismiss(); },
    },
  };
}
