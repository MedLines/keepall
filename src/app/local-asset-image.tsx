"use client";

import { useAssetObjectUrl } from "./use-asset-object-url";
import { useCallback, useState } from "react";

export function LocalAssetImage({ assetId, alt, pendingImageUrls }: {
  assetId: string;
  alt: string;
  pendingImageUrls?: ReadonlyMap<string, string>;
}) {
  const pendingUrl = pendingImageUrls?.get(assetId);
  const [unavailableId, setUnavailableId] = useState<string | null>(null);
  const unavailable = useCallback(() => setUnavailableId(assetId), [assetId]);
  const savedUrl = useAssetObjectUrl(pendingUrl ? null : assetId, { onUnavailable: unavailable });
  const url = pendingUrl ?? savedUrl;

  if (unavailableId === assetId) return <span role="img" aria-label={alt || "Image"} className="text-sm text-text-secondary">Image unavailable.{alt ? ` ${alt}` : ""}</span>;
  if (!url) {
    return <span role="img" aria-label={alt || "Image"} className="text-sm text-text-secondary">Loading image…</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element -- local IndexedDB object URL
  return <img src={url} alt={alt || "Image"} onError={unavailable} className="media-outline my-5 block h-auto max-h-[48rem] max-w-full rounded-input object-contain" />;
}

