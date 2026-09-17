"use client";

import { cardInitial, linkFaviconUrl } from "@/domain/card-display";
import { imageCoverAssetId } from "@/domain/image";
import type { Item } from "@/domain/item";
import { useAssetObjectUrl } from "./use-asset-object-url";
import { useEffect, useState } from "react";
import { ImageIcon, LinkIcon, NoteIcon } from "./shell-icons";

type Props = {
  item: Item;
  /** Grid preserves image proportions; compact rows crop; inspect contains. */
  variant?: "card" | "grid" | "inspect";
  onImageLoad?: (ratio: number) => void;
  onPreviewUnavailable?: () => void;
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
  onImageLoad,
  onPreviewUnavailable,
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
      ? linkFaviconUrl(item.url, { size: 64 })
      : null;
  const imageSrc = previewSrc ?? faviconSrc;
  const isFaviconOnly = Boolean(faviconSrc && imageSrc === faviconSrc);
  const isInspect = variant === "inspect";

  if (variant === "grid" && item.type === "link" && !previewSrc) return null;

  if (isFaviconOnly && faviconSrc) {
    return (
      <div
        aria-hidden="true"
        className={
          compact
            ? `flex size-full items-center justify-center bg-bg-surface ${className}`
            : `flex aspect-[16/10] h-full w-full items-center justify-center bg-bg-surface ${className}`
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- remote favicon at native size */}
        <img
          alt=""
          className={compact ? "size-8 object-contain" : "size-12 object-contain"}
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
          variant === "grid"
            ? `block h-auto w-full rounded-[inherit] outline outline-1 -outline-offset-1 outline-border-media ${className}`
            : isInspect
            ? `mx-auto max-h-[min(78vh,56rem)] w-full object-contain outline outline-1 -outline-offset-1 outline-white/10 ${className}`
            : compact
              ? `size-full rounded-[inherit] object-cover outline outline-1 -outline-offset-1 outline-border-media ${className}`
              : `aspect-[16/10] h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10 ${className}`
        }
        src={imageSrc}
        onLoad={(event) => onImageLoad?.(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)}
        onError={() => {
          if (variant === "grid" && item.type === "link") onPreviewUnavailable?.();
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
          ? `flex min-h-48 items-center justify-center bg-bg-media text-5xl font-semibold text-text-on-media ${className}`
          : compact
            ? `flex size-full items-center justify-center bg-bg-raised text-sm font-semibold text-text-primary ${className}`
            : `flex aspect-[16/10] items-center justify-center bg-bg-raised text-4xl font-semibold text-text-primary ${className}`
      }
    >
      {compact ? item.type === "note" ? <NoteIcon className="size-6" /> : item.type === "link" ? <LinkIcon className="size-6" /> : <ImageIcon className="size-6" /> : cardInitial(item)}
    </div>
  );
}
