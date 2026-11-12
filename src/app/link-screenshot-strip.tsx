"use client";

import type { LinkItem } from "@/domain/link";
import { linkScreenshots } from "@/domain/link-screenshot";
import { useThumbnailObjectUrl } from "./use-thumbnail-object-url";

type StripOption = { assetId: string; label: string };

/** Thumbnails for a link's page preview (optional) and screenshots, in that order. */
export function linkStripOptions(link: LinkItem, includePreview: boolean): StripOption[] {
  return [
    ...(includePreview && link.previewAssetId ? [{ assetId: link.previewAssetId, label: "Page preview" }] : []),
    ...linkScreenshots(link).map((shot, index) => ({ assetId: shot.assetId, label: `Screenshot ${index + 1}` })),
  ];
}

export function LinkScreenshotStrip({ link, selected, onSelect, includePreview = false, label = "Screenshots", className = "" }: {
  link: LinkItem;
  selected: string | null;
  onSelect: (assetId: string) => void;
  includePreview?: boolean;
  label?: string;
  className?: string;
}) {
  if (!linkScreenshots(link).length) return null;
  const options = linkStripOptions(link, includePreview);
  return <div role="group" aria-label={label} className={`flex gap-2 overflow-x-auto p-0.5 ${className}`}>
    {options.map((option) => <StripThumb key={option.assetId} option={option} selected={option.assetId === selected} onSelect={onSelect} />)}
  </div>;
}

function StripThumb({ option, selected, onSelect }: { option: StripOption; selected: boolean; onSelect: (assetId: string) => void }) {
  const url = useThumbnailObjectUrl(option.assetId);
  return <button type="button" aria-pressed={selected} aria-label={option.label} onClick={() => onSelect(option.assetId)}
    className={`relative h-14 w-[5.5rem] shrink-0 overflow-hidden rounded-input border bg-bg-surface outline-none transition-[border-color,opacity] focus-visible:ring-2 focus-visible:ring-border-focus ${selected ? "border-border-selected" : "border-border-control opacity-70 hover:opacity-100"}`}>
    {/* eslint-disable-next-line @next/next/no-img-element -- local IndexedDB object URL */}
    {url ? <img alt="" src={url} className="size-full object-cover object-top" /> : null}
  </button>;
}
