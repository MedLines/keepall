"use client";

import { useEffect, useState } from "react";
import {
  persistentStorageMessage,
  requestPersistentStorage,
  type PersistentStorageStatus,
} from "@/pwa/persistent-storage";
import { CloseIcon } from "./shell-icons";

const STORAGE_STATUS_DISMISSED_KEY = "keepall.storage-status-dismissed";

type PersistentStorageStatusLineProps = {
  requestPersistentStorage?: boolean;
};

export function PersistentStorageStatusLine({
  requestPersistentStorage: shouldRequest = true,
}: PersistentStorageStatusLineProps) {
  const [storageStatus, setStorageStatus] =
    useState<PersistentStorageStatus | null>(null);
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!shouldRequest) {
      return;
    }

    let cancelled = false;

    void requestPersistentStorage().then((status) => {
      if (!cancelled) {
        let storedDismissal = false;
        try {
          storedDismissal =
            window.localStorage.getItem(STORAGE_STATUS_DISMISSED_KEY) ===
            "true";
        } catch {
          // The warning can still be dismissed for this session when storage is blocked.
        }
        setDismissed(storedDismissal);
        setStorageStatus(status);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [shouldRequest]);

  if (!storageStatus || dismissed !== false) {
    return null;
  }

  return (
    <div
      className="relative flex min-h-10 items-center justify-center border-b border-border-edge bg-bg-raised px-12 py-1.5 text-center text-xs text-text-secondary"
      data-testid="persistent-storage-status"
    >
      <p>{persistentStorageMessage(storageStatus)}</p>
      <button
        type="button"
        aria-label={
          storageStatus === "granted"
            ? "Dismiss storage message"
            : "Dismiss storage warning"
        }
        className="absolute end-0 top-0 flex size-10 items-center justify-center text-text-secondary transition-[color,scale] duration-150 ease-out hover:text-text-primary active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-border-focus motion-reduce:transition-colors motion-reduce:active:scale-100"
        onClick={() => {
          setDismissed(true);
          try {
            window.localStorage.setItem(STORAGE_STATUS_DISMISSED_KEY, "true");
          } catch {
            // State still dismisses the warning for this session.
          }
        }}
      >
        <CloseIcon className="size-4" />
      </button>
    </div>
  );
}
