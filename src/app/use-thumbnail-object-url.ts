"use client";

import { useEffect, useState } from "react";
import { acquireThumbnailObjectUrl, peekThumbnailObjectUrl, THUMBNAIL_UPDATED_EVENT } from "./asset-object-url-cache";

export function useThumbnailObjectUrl(assetId: string | null): string | null {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ id: string; url: string } | null>(() => {
    const url = typeof window !== "undefined" && assetId ? peekThumbnailObjectUrl(assetId) : null;
    return url && assetId ? { id: assetId, url } : null;
  });
  useEffect(() => {
    if (!assetId) return;
    const updated = (event: Event) => { if ((event as CustomEvent<string>).detail === assetId) setRevision(value => value + 1); };
    window.addEventListener(THUMBNAIL_UPDATED_EVENT, updated);
    return () => window.removeEventListener(THUMBNAIL_UPDATED_EVENT, updated);
  }, [assetId]);
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
  }, [assetId, revision]);
  return result?.id === assetId ? result.url : null;
}
