"use client";

import { useEffect, useState } from "react";
import { probeNetworkReachable } from "@/pwa/connectivity";

const CONNECTIVITY_POLL_MS = 8_000;

export function OfflineBanner() {
  const [mounted, setMounted] = useState(false);
  const [browserOffline, setBrowserOffline] = useState(false);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only mount + connectivity
    setMounted(true);

    let cancelled = false;

    const readBrowserOffline = () => {
      setBrowserOffline(!navigator.onLine);
    };

    const runProbe = async () => {
      // Fast path when the browser already admits offline.
      if (!navigator.onLine) {
        if (!cancelled) {
          setUnreachable(true);
        }
        return;
      }

      const reachable = await probeNetworkReachable();
      if (!cancelled) {
        setUnreachable(!reachable);
      }
    };

    readBrowserOffline();
    void runProbe();

    const onOffline = () => {
      readBrowserOffline();
      setUnreachable(true);
    };
    const onOnline = () => {
      readBrowserOffline();
      void runProbe();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void runProbe();
      }
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);

    const intervalId = window.setInterval(() => {
      if (cancelled || document.visibilityState !== "visible") {
        return;
      }
      void runProbe();
    }, CONNECTIVITY_POLL_MS);

    return () => {
      cancelled = true;
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(intervalId);
    };
  }, []);

  if (!mounted) {
    return null;
  }

  if (!browserOffline && !unreachable) {
    return null;
  }

  return (
    <div
      data-testid="offline-banner"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950"
      role="status"
    >
      You are offline. Your library on this device still works.
    </div>
  );
}
