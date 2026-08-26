"use client";

import { useState } from "react";
import {
  cardInitial,
  cardSecondaryLine,
  linkCardHost,
} from "@/domain/card-display";
import { itemListTitle, type Item } from "@/domain/item";
import { LibraryItemMedia } from "./library-item-media";

type Props = {
  item: Item;
  inspected: boolean;
  onOpenInspect: () => void;
};

function typeLabel(item: Item): string {
  if (item.type === "link") {
    return "Link";
  }
  if (item.type === "image") {
    return "Image";
  }
  return "Note";
}

function formatListDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Compact list row: thumb + title + secondary + type/date. Opens inspect. */
export function LibraryListRow({ item, inspected, onOpenInspect }: Props) {
  const title = itemListTitle(item);
  const secondary = cardSecondaryLine(item);
  const [faviconBroken, setFaviconBroken] = useState(false);

  const faviconUrl =
    item.type === "link" && !faviconBroken
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(linkCardHost(item))}&sz=32`
      : null;

  const showMediaThumb =
    (item.type === "link" &&
      Boolean(item.previewAssetId || item.previewImageUrl)) ||
    item.type === "image";

  return (
    <li
      className={`rounded-lg border border-zinc-200 bg-white ${
        inspected ? "ring-2 ring-zinc-900" : ""
      }`}
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-zinc-50"
        onClick={onOpenInspect}
        aria-label={`Open ${title}`}
      >
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-200 text-sm font-semibold text-zinc-700">
          {showMediaThumb ? (
            <LibraryItemMedia
              item={item}
              className="!aspect-auto size-10 object-cover"
            />
          ) : faviconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- best-effort external favicon
            <img
              alt=""
              className="size-5"
              src={faviconUrl}
              onError={() => setFaviconBroken(true)}
            />
          ) : (
            cardInitial(item)
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-zinc-900">
            {title}
          </span>
          {secondary ? (
            <span className="block truncate text-xs text-zinc-500">
              {secondary}
            </span>
          ) : null}
        </span>
        <span className="hidden shrink-0 items-center gap-3 text-xs text-zinc-500 sm:flex">
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600">
            {typeLabel(item)}
          </span>
          <time dateTime={new Date(item.createdAt).toISOString()}>
            {formatListDate(item.createdAt)}
          </time>
        </span>
      </button>
    </li>
  );
}
