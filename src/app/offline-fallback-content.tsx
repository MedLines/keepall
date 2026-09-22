"use client";

import { useEffect, useState } from "react";
import { safeLibraryReturnHref } from "./item-page-navigation";
import { ItemPageContent } from "./item-page-content";

type OfflineItem = { id: string; returnHref: string };

function itemFromCurrentUrl(): OfflineItem | null {
  const match = /^\/items\/([^/]+)$/.exec(window.location.pathname);
  if (!match) return null;

  try {
    return {
      id: decodeURIComponent(match[1]!),
      returnHref: safeLibraryReturnHref(
        new URLSearchParams(window.location.search).get("from") ?? undefined,
      ),
    };
  } catch {
    return null;
  }
}

export function OfflineFallbackContent() {
  const [item, setItem] = useState<OfflineItem | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setItem(itemFromCurrentUrl()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (item) {
    return <ItemPageContent itemId={item.id} returnHref={item.returnHref} />;
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-3xl font-semibold tracking-tight">Keepall</h1>
      <p className="mt-4 text-sm text-text-primary">
        You are offline and this page is not in the cached app shell yet. Open
        Keepall once while online, then it can load from this device without a
        network.
      </p>
      <p className="mt-2 text-sm text-text-secondary">
        Your library still lives in IndexedDB on this browser, not in the
        service worker cache.
      </p>
    </main>
  );
}
