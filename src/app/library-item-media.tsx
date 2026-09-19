"use client";

import { cardInitial } from "@/domain/card-display";
import { imageCoverAssetId } from "@/domain/image";
import type { Item } from "@/domain/item";
import { useAssetObjectUrl } from "./use-asset-object-url";
import { useState } from "react";
import { ImageIcon, LinkIcon, NoteIcon } from "./shell-icons";

type Props = {
  item: Item;
  /** Grid preserves image proportions; compact rows crop; inspect contains. */
  variant?: "card" | "grid" | "inspect";
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
  const assetIdForDisplay =
    assetId !== undefined
      ? assetId
      : item.type === "link"
        ? item.previewAssetId
        : item.type === "image"
          ? imageCoverAssetId(item)
          : null;
  const localObjectUrl = useAssetObjectUrl(assetIdForDisplay);
  const [brokenAssetId, setBrokenAssetId] = useState<string | null>(null);
  const imageSrc = brokenAssetId === assetIdForDisplay ? null : localObjectUrl;
  const isInspect = variant === "inspect";

  if (variant === "grid" && item.type === "link" && !imageSrc) return null;

  if (imageSrc && (item.type === "link" || item.type === "image")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local object URLs + remote OG
      <img
        alt=""
        className={
          variant === "grid"
            ? `block h-auto w-full ${className}`
            : isInspect
            ? `mx-auto max-h-[min(78vh,56rem)] w-full object-contain outline outline-1 -outline-offset-1 outline-border-media ${className}`
            : compact
              ? `size-full rounded-[inherit] object-cover outline outline-1 -outline-offset-1 outline-border-media ${className}`
              : `aspect-[16/10] h-full w-full object-cover outline outline-1 -outline-offset-1 outline-border-media ${className}`
        }
        src={imageSrc}
        onLoad={(event) => onImageLoad?.(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)}
        onError={() => {
          setBrokenAssetId(assetIdForDisplay);
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
