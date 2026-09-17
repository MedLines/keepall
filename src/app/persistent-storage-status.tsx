"use client";

import { useEffect, useState } from "react";
import {
  persistentStorageMessage,
  requestPersistentStorage,
  type PersistentStorageStatus,
} from "@/pwa/persistent-storage";

type PersistentStorageStatusLineProps = {
  requestPersistentStorage?: boolean;
};

export function PersistentStorageStatusLine({
  requestPersistentStorage: shouldRequest = true,
}: PersistentStorageStatusLineProps) {
  const [storageStatus, setStorageStatus] =
    useState<PersistentStorageStatus | null>(null);

  useEffect(() => {
    if (!shouldRequest) {
      return;
    }

    let cancelled = false;

    void requestPersistentStorage().then((status) => {
      if (!cancelled) {
        setStorageStatus(status);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [shouldRequest]);

  if (!storageStatus) {
    return null;
  }

  return (
    <p
      className="border-b border-border-edge bg-bg-raised px-4 py-1.5 text-center text-xs text-text-secondary"
      data-testid="persistent-storage-status"
    >
      {persistentStorageMessage(storageStatus)}
    </p>
  );
}
