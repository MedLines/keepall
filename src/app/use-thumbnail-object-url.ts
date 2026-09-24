"use client";

import { useEffect, useState } from "react";
import { acquireThumbnailObjectUrl } from "./asset-object-url-cache";

export function useThumbnailObjectUrl(assetId: string | null): string | null {
  const [result, setResult] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!assetId) return;
    let active = true;
    const handle = acquireThumbnailObjectUrl(assetId);
    void handle.promise.then((url) => {
      if (active && url) setResult({ id: assetId, url });
    });
    return () => {
      active = false;
      handle.release();
    };
  }, [assetId]);
  return result?.id === assetId ? result.url : null;
}
