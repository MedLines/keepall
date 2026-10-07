"use client";

import { cardInitial, linkFaviconUrls } from "@/domain/card-display";
import { imageCoverAssetId } from "@/domain/image";
import type { Item } from "@/domain/item";
import type { LinkItem } from "@/domain/link";
import { useAssetObjectUrl } from "./use-asset-object-url";
import { useThumbnailObjectUrl } from "./use-thumbnail-object-url";
import { useState } from "react";
import { ItemViewTransition } from "./item-view-transition";
import { ItemTypeIcon } from "./item-type-icon";
import { PdfCardThumbnail } from "./pdf-card-thumbnail";
import { peekPreviewLayout, rememberPreviewLayout } from "@/persistence/preview-layouts";
import { LibraryThumbnailImage } from "./library-thumbnail-image";

type MediaVariant = "card" | "grid" | "inspect" | "canvas" | "viewer" | "preview";

type Props = {
  item: Item;
  /** Grid preserves proportions, cards crop, inspect fits, canvas fits without upscaling, viewer keeps natural height, and preview contains without upscaling. */
  variant?: MediaVariant;
  onImageLoad?: (ratio: number, dimensions: { width: number; height: number }) => void;
  /** Inspect gallery: show this asset instead of the cover. */
  assetId?: string | null;
  /** Smaller favicon for list-row thumbs. */
  compact?: boolean;
  /** Dense link lists show identity without loading the OG asset. */
  faviconOnly?: boolean;
  className?: string;
  sharedTransition?: boolean;
};

/** Renders link/image preview or note letter. No links; inspect owns outbound. */
export function LibraryItemMedia({
  item,
  variant = "card",
  assetId,
  compact = false,
  faviconOnly = false,
  onImageLoad,
  className = "",
  sharedTransition = true,
}: Props) {
  const assetIdForDisplay = faviconOnly && item.type === "link" ? null : resolveAssetId(item, assetId);
  const useThumbnail = ["card", "grid"].includes(variant) && (item.type === "image" || item.type === "video");
  const originalUrl = useAssetObjectUrl(assetIdForDisplay, { enabled: !useThumbnail });
  const thumbnailUrl = useThumbnailObjectUrl(useThumbnail || item.type === "image" ? assetIdForDisplay : null);
  const localObjectUrl = useThumbnail ? thumbnailUrl : originalUrl ?? (item.type === "image" ? thumbnailUrl : null);
  const [brokenAssetId, setBrokenAssetId] = useState<string | null>(null);
  const [decodedLayout, setDecodedLayout] = useState<{ assetId: string; width: number; height: number } | null>(null);
  const dimensions = decodedLayout?.assetId === assetIdForDisplay ? decodedLayout : peekPreviewLayout(assetIdForDisplay);
  const imageSrc = brokenAssetId === assetIdForDisplay ? null : localObjectUrl;

  if (item.type === "document" && item.format === "pdf") {
    return <PdfCardThumbnail item={item} compact={compact} />;
  }

  if (imageSrc && (item.type === "link" || item.type === "image" || item.type === "video")) {
    const image = (
      <LibraryThumbnailImage
        animate={variant === "grid" || variant === "card"}
        data-preview-image-asset={variant === "preview" && item.type === "image" ? assetIdForDisplay : undefined}
        alt=""
        className={imageClassName(variant, compact, className)}
        src={imageSrc}
        width={dimensions?.width}
        height={dimensions?.height}
        onLoad={(event) => {
          const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
          if (assetIdForDisplay && width > 0 && height > 0) {
            setDecodedLayout({ assetId: assetIdForDisplay, width, height });
            void rememberPreviewLayout(assetIdForDisplay, width, height).catch(() => {});
          }
          onImageLoad?.(width / height, { width, height });
        }}
        onError={() => {
          setBrokenAssetId(assetIdForDisplay);
        }}
      />
    );
    return sharedTransition && item.type === "image" && assetIdForDisplay && ["card", "grid", "inspect", "preview"].includes(variant)
      ? <ItemViewTransition itemId={item.id} assetId={assetIdForDisplay} source={variant !== "inspect"} preview={variant === "preview"}>{image}</ItemViewTransition>
      : image;
  }

  if (item.type === "link") {
    return <LinkFavicon key={item.url} item={item} variant={variant} compact={compact} className={className} dimensions={dimensions} />;
  }

  return (
    <div
      aria-hidden="true"
      className={fallbackClassName(variant, compact, className)}
      style={variant === "grid" && dimensions ? { aspectRatio: `${dimensions.width} / ${dimensions.height}` } : undefined}
    >
      {assetIdForDisplay && brokenAssetId !== assetIdForDisplay ? null : <FallbackContent item={item} compact={compact} />}
    </div>
  );
}

function LinkFavicon({ item, variant, compact, className, dimensions }: {
  item: LinkItem; variant: MediaVariant; compact: boolean; className: string; dimensions?: { width: number; height: number };
}) {
  const [faviconIndex, setFaviconIndex] = useState(0);
  const candidates = linkFaviconUrls(item.url, { size: compact ? 64 : 128 });
  const faviconSrc = candidates[faviconIndex];

  return (
    <div aria-hidden="true" className={fallbackClassName(variant, compact, className)}
      style={variant === "grid" && dimensions ? { aspectRatio: `${dimensions.width} / ${dimensions.height}` } : undefined}>
      {faviconSrc ? (
        <LibraryThumbnailImage
          alt=""
          className={compact || faviconIndex > 0 ? "size-8 object-contain" : "size-16 object-contain"}
          src={faviconSrc}
          animate={variant === "card" || variant === "grid"}
          onError={() => setFaviconIndex(faviconIndex + 1)}
        />
      ) : <FallbackContent item={item} compact={compact} />}
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
  if (variant === "preview") {
    return `media-outline block h-auto w-auto max-h-full max-w-full rounded-input object-contain ${className}`;
  }
  if (variant === "viewer") {
    return `media-outline mx-auto block h-auto w-auto max-w-full ${className}`;
  }
  if (variant === "canvas") {
    return `media-outline block h-auto w-auto max-h-full max-w-full rounded-none object-contain ${className}`;
  }
  if (variant === "inspect") {
    return `media-outline media-squircle-inset mx-auto block h-auto max-h-[min(78vh,56rem)] w-auto max-w-full object-contain ${className}`;
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
  if (variant === "preview") {
    return `flex size-full min-h-0 items-center justify-center rounded-input bg-bg-media text-5xl font-semibold text-text-on-media ${className}`;
  }
  if (variant === "canvas" || variant === "viewer") {
    return `flex min-h-48 items-center justify-center bg-bg-image-viewer text-5xl font-semibold text-text-primary ${className}`;
  }
  if (variant === "inspect") {
    return `flex min-h-48 items-center justify-center bg-bg-media text-5xl font-semibold text-text-on-media ${className}`;
  }
  if (compact) {
    return `flex size-full items-center justify-center bg-bg-raised text-sm font-semibold text-text-primary ${className}`;
  }
  return `flex aspect-[16/10] items-center justify-center bg-bg-raised text-4xl font-semibold text-text-primary ${className}`;
}

function FallbackContent({ item, compact }: { item: Item; compact: boolean }) {
  if (item.type === "link" || item.type === "document" || item.type === "note") return <ItemTypeIcon item={item} className={compact ? "size-6" : "size-10"} />;
  if (!compact) return cardInitial(item);
  return <ItemTypeIcon item={item} className="size-6" />;
}
