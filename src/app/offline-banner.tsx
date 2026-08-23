"use client";

import { useLayoutEffect, useState } from "react";
import { useOffline } from "next/offline";

export function OfflineBanner() {
  const hookOffline = useOffline();
  const [mounted, setMounted] = useState(false);
  const [connectivityRevision, setConnectivityRevision] = useState(0);

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- gate client-only navigator.onLine reads
    setMounted(true);

    const syncConnectivity = () => {
      setConnectivityRevision((revision) => revision + 1);
    };

    syncConnectivity();
    window.addEventListener("offline", syncConnectivity);
    window.addEventListener("online", syncConnectivity);
    return () => {
      window.removeEventListener("offline", syncConnectivity);
      window.removeEventListener("online", syncConnectivity);
    };
  }, []);

  void connectivityRevision;

  if (!mounted) {
    return null;
  }

  const isOffline = !navigator.onLine || hookOffline;

  if (!isOffline) {
    return null;
  }

  return (
    <div
      data-testid="offline-banner"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950"
      role="status"
    >
      You’re offline. Your library on this device still works.
    </div>
  );
}
