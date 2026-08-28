"use client";

import { cardInitial, linkFaviconUrl } from "@/domain/card-display";
import { imageCoverAssetId } from "@/domain/image";
import type { Item } from "@/domain/item";
import { useAssetObjectUrl } from "./use-asset-object-url";
import { useEffect, useState } from "react";

type Props = {
  item: Item;
  /** Card thumbs crop; inspect shows the full image. */
  variant?: "card" | "inspect";
  /** Inspect gallery: show this asset instead of the cover. */
  assetId?: string | null;
  /** Smaller favicon for list-row thumbs. */
  compact?: boolean;
  className?: string;
};

/** Renders link/image preview or note letter. No links; inspect owns outbound. */
export function LibraryItemMedia({
  item,
  variant = "card",
  assetId,
  compact = false,
  className = "",
}: Props) {
  const assetIdForDisplay =
    assetId !== undefined
      ? assetId
      : item.type === "link"
        ? item.previewAssetId
        : item.type === "image"
          ? imageCoverAssetId(item)
          : null;
  const localObjectUrl = useAssetObjectUrl(assetIdForDisplay);
  const [remoteBroken, setRemoteBroken] = useState(false);
  const [faviconBroken, setFaviconBroken] = useState(false);
  const remotePreviewUrl =
    item.type === "link" ? item.previewImageUrl : "";

  useEffect(() => {
    setRemoteBroken(false);
    setFaviconBroken(false);
  }, [item.id, remotePreviewUrl, assetIdForDisplay]);

  const remoteUrl =
    item.type === "link" &&
    item.previewStatus === "ready" &&
    remotePreviewUrl &&
    !remoteBroken
      ? remotePreviewUrl
      : null;
  const previewSrc = localObjectUrl ?? remoteUrl;
  const faviconSrc =
    item.type === "link" && !previewSrc && !faviconBroken
      ? linkFaviconUrl(item.url, { size: compact ? 32 : 64 })
      : null;
  const imageSrc = previewSrc ?? faviconSrc;
  const isFaviconOnly = Boolean(faviconSrc && imageSrc === faviconSrc);
  const isInspect = variant === "inspect";

  if (isFaviconOnly && faviconSrc) {
    return (
      <div
        aria-hidden="true"
        className={
          compact
            ? `flex size-full items-center justify-center bg-white ${className}`
            : `flex aspect-[16/10] h-full w-full items-center justify-center bg-white ${className}`
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- remote favicon at native size */}
        <img
          alt=""
          className={compact ? "size-5 object-contain" : "size-12 object-contain"}
          src={faviconSrc}
          onError={() => setFaviconBroken(true)}
        />
      </div>
    );
  }

  if (imageSrc && (item.type === "link" || item.type === "image")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local object URLs + remote OG
      <img
        alt=""
        className={
          isInspect
            ? `mx-auto max-h-[min(78vh,56rem)] w-full object-contain outline outline-1 -outline-offset-1 outline-white/10 ${className}`
            : compact
              ? `size-full object-cover outline outline-1 -outline-offset-1 outline-black/10 ${className}`
              : `aspect-[16/10] h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10 ${className}`
        }
        src={imageSrc}
        onError={() => {
          if (previewSrc) {
            if (!localObjectUrl) {
              setRemoteBroken(true);
            }
            return;
          }
          setFaviconBroken(true);
        }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={
        isInspect
          ? `flex min-h-48 items-center justify-center bg-zinc-900 text-5xl font-semibold text-zinc-400 ${className}`
          : compact
            ? `flex size-full items-center justify-center bg-zinc-200 text-sm font-semibold text-zinc-700 ${className}`
            : `flex aspect-[16/10] items-center justify-center bg-zinc-200 text-4xl font-semibold text-zinc-700 ${className}`
      }
    >
      {cardInitial(item)}
    </div>
  );
}
