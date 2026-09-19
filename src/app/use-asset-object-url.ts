"use client";

import { useEffect, useState } from "react";
import {
  isLibraryNavigationStale,
  useLibraryNavigationGenerationRef,
} from "./library-navigation";
import { acquireAssetObjectUrl } from "./asset-object-url-cache";

/**
 * Load a local asset Blob and expose a shared object URL for <img src>.
 * Recently unmounted assets stay in a small cache so virtual scrolling does
 * not keep reading IndexedDB and rebuilding the same URL.
 */
export function useAssetObjectUrl(
  assetId: string | null,
  options?: { enabled?: boolean },
): string | null {
  const enabled = options?.enabled !== false;
  const navigationGenerationRef = useLibraryNavigationGenerationRef();
  const [resolved, setResolved] = useState<{
    assetId: string;
    url: string;
  } | null>(null);

  useEffect(() => {
    if (!assetId || !enabled) {
      return;
    }

    let cancelled = false;
    const capturedGeneration = navigationGenerationRef?.current ?? 0;
    const handle = acquireAssetObjectUrl(assetId);

    void handle.promise.then((url) => {
      if (
        cancelled ||
        !url ||
        (navigationGenerationRef !== null &&
          isLibraryNavigationStale(navigationGenerationRef, capturedGeneration))
      ) {
        return;
      }
      setResolved({ assetId, url });
    });

    return () => {
      cancelled = true;
      handle.release();
    };
  }, [assetId, enabled, navigationGenerationRef]);

  return enabled && resolved?.assetId === assetId ? resolved.url : null;
}
