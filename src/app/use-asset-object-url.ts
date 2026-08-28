"use client";

import { useEffect, useState } from "react";
import { getAsset, assetToBlob } from "@/persistence/assets";

/**
 * Load a local asset Blob and expose a short-lived object URL for <img src>.
 * Revokes the URL on change/unmount so memory does not leak.
 */
export function useAssetObjectUrl(
  assetId: string | null,
  options?: { enabled?: boolean },
): string | null {
  const enabled = options?.enabled !== false;
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId || !enabled) {
      setObjectUrl(null);
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;

    void getAsset(assetId).then((asset) => {
      if (cancelled || !asset) {
        return;
      }
      createdUrl = URL.createObjectURL(assetToBlob(asset));
      setObjectUrl(createdUrl);
    });

    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [assetId, enabled]);

  return objectUrl;
}
