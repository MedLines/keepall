"use client";

import { cardInitial } from "@/domain/card-display";
import { imageCoverAssetId } from "@/domain/image";
import type { Item } from "@/domain/item";
import { useAssetObjectUrl } from "./use-asset-object-url";
import { useEffect, useState } from "react";

type Props = {
  item: Item;
  /** Card thumbs crop; inspect shows the full image. */
  variant?: "card" | "inspect";
  className?: string;
};

/** Renders link/image preview or note letter — no links (inspect owns outbound). */
export function LibraryItemMedia({
  item,
  variant = "card",
  className = "",
}: Props) {
  const assetIdForDisplay =
    item.type === "link"
      ? item.previewAssetId
      : item.type === "image"
        ? imageCoverAssetId(item)
        : null;
  const localObjectUrl = useAssetObjectUrl(assetIdForDisplay);
  const [remoteBroken, setRemoteBroken] = useState(false);
  const remotePreviewUrl =
    item.type === "link" ? item.previewImageUrl : "";

  useEffect(() => {
    setRemoteBroken(false);
  }, [item.id, remotePreviewUrl]);

  const remoteUrl =
    item.type === "link" &&
    item.previewStatus === "ready" &&
    remotePreviewUrl &&
    !remoteBroken
      ? remotePreviewUrl
      : null;
  const imageSrc = localObjectUrl ?? remoteUrl;
  const isInspect = variant === "inspect";

  if (imageSrc && (item.type === "link" || item.type === "image")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local object URLs + remote OG
      <img
        alt=""
        className={
          isInspect
            ? `mx-auto max-h-[min(78vh,56rem)] w-full object-contain outline outline-1 -outline-offset-1 outline-white/10 ${className}`
            : `aspect-[16/10] h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10 ${className}`
        }
        src={imageSrc}
        onError={() => {
          if (!localObjectUrl) {
            setRemoteBroken(true);
          }
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
          : `flex aspect-[16/10] items-center justify-center bg-zinc-200 text-4xl font-semibold text-zinc-700 ${className}`
      }
    >
      {cardInitial(item)}
    </div>
  );
}
