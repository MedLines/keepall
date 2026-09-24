"use client";

import { cardInitial, linkFaviconUrl } from "@/domain/card-display";
import { imageCoverAssetId } from "@/domain/image";
import type { Item } from "@/domain/item";
import { useAssetObjectUrl } from "./use-asset-object-url";
import { useThumbnailObjectUrl } from "./use-thumbnail-object-url";
import { useState } from "react";
import { ImageIcon, LinkIcon, NoteIcon, VideoIcon } from "./shell-icons";

type MediaVariant = "card" | "grid" | "inspect" | "viewer";

type Props = {
  item: Item;
  /** Grid preserves proportions, cards crop, inspect fits, and viewer keeps natural height. */
  variant?: MediaVariant;
  onImageLoad?: (ratio: number) => void;
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
  className = "",
}: Props) {
  const assetIdForDisplay = resolveAssetId(item, assetId);
  const useThumbnail = (item.type === "image" || item.type === "video") && variant !== "inspect" && variant !== "viewer";
  const originalUrl = useAssetObjectUrl(assetIdForDisplay, { enabled: !useThumbnail });
  const thumbnailUrl = useThumbnailObjectUrl(useThumbnail ? assetIdForDisplay : null);
  const localObjectUrl = useThumbnail ? thumbnailUrl : originalUrl;
  const [brokenAssetId, setBrokenAssetId] = useState<string | null>(null);
  const [brokenFaviconUrl, setBrokenFaviconUrl] = useState<string | null>(null);
  const imageSrc = brokenAssetId === assetIdForDisplay ? null : localObjectUrl;

  if (imageSrc && (item.type === "link" || item.type === "image" || item.type === "video")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local object URLs + remote OG
      <img
        alt=""
        className={imageClassName(variant, compact, className)}
        src={imageSrc}
        onLoad={(event) => onImageLoad?.(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)}
        onError={() => {
          setBrokenAssetId(assetIdForDisplay);
        }}
      />
    );
  }

  const faviconUrl = item.type === "link"
    ? linkFaviconUrl(item.url, { size: compact ? 64 : 128 })
    : null;
  const faviconSrc = faviconUrl === brokenFaviconUrl ? null : faviconUrl;

  if (item.type === "link" && faviconSrc) {
    return (
      <div
        aria-hidden="true"
        className={fallbackClassName(variant, compact, className)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- remote favicon is best-effort and falls back offline */}
        <img
          alt=""
          className={compact ? "size-8 object-contain" : "size-16 object-contain"}
          src={faviconSrc}
          onError={() => setBrokenFaviconUrl(faviconUrl)}
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={fallbackClassName(variant, compact, className)}
    >
      <FallbackContent item={item} compact={compact} />
    </div>
  );
}

function resolveAssetId(item: Item, assetId?: string | null) {
  if (assetId !== undefined) return assetId;
  if (item.type === "link") return item.previewAssetId;
  if (item.type === "image") return imageCoverAssetId(item);
  if (item.type === "video") return item.assetId;
  return null;
}

function imageClassName(
  variant: MediaVariant,
  compact: boolean,
  className: string,
) {
  if (variant === "grid") {
    return `media-outline media-squircle-inset block h-auto w-full ${className}`;
  }
  if (variant === "viewer") {
    return `media-outline mx-auto block h-auto w-auto max-w-full ${className}`;
  }
  if (variant === "inspect") {
    return `media-outline media-squircle-inset mx-auto max-h-[min(78vh,56rem)] w-full object-contain ${className}`;
  }
  if (compact) {
    return `media-outline size-full rounded-[inherit] object-cover ${className}`;
  }
  return `media-outline aspect-[16/10] h-full w-full object-cover ${className}`;
}

function fallbackClassName(
  variant: MediaVariant,
  compact: boolean,
  className: string,
) {
  if (variant === "inspect" || variant === "viewer") {
    return `flex min-h-48 items-center justify-center bg-bg-media text-5xl font-semibold text-text-on-media ${className}`;
  }
  if (compact) {
    return `flex size-full items-center justify-center bg-bg-raised text-sm font-semibold text-text-primary ${className}`;
  }
  return `flex aspect-[16/10] items-center justify-center bg-bg-raised text-4xl font-semibold text-text-primary ${className}`;
}

function FallbackContent({ item, compact }: { item: Item; compact: boolean }) {
  if (item.type === "link") {
    return <LinkIcon className={compact ? "size-6" : "size-12"} />;
  }
  if (!compact) return cardInitial(item);
  if (item.type === "note") return <NoteIcon className="size-6" />;
  if (item.type === "video") return <VideoIcon className="size-6" />;
  return <ImageIcon className="size-6" />;
}
