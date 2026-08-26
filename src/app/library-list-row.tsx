"use client";

import { type DragEvent, useState } from "react";
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
  selected: boolean;
  selectionActive: boolean;
  onOpenInspect: () => void;
  onToggleSelect: () => void;
  dragEnabled: boolean;
  isDragging: boolean;
  onItemDragStart: (event: DragEvent<HTMLElement>) => void;
  onItemDragEnd: () => void;
  pinVisible: boolean;
  pinned: boolean;
  onTogglePin: () => void;
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
export function LibraryListRow({
  item,
  inspected,
  selected,
  selectionActive,
  onOpenInspect,
  onToggleSelect,
  dragEnabled,
  isDragging,
  onItemDragStart,
  onItemDragEnd,
  pinVisible,
  pinned,
  onTogglePin,
}: Props) {
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

  const checkboxVisible = selected || selectionActive;

  return (
    <li
      draggable={dragEnabled}
      className={`group rounded-lg border border-zinc-200 bg-white transition-opacity duration-150 ease-out ${
        inspected || selected ? "ring-2 ring-zinc-900" : ""
      } ${isDragging ? "opacity-50" : ""}`}
      onDragStart={onItemDragStart}
      onDragEnd={onItemDragEnd}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        <label
          className={`flex size-8 shrink-0 items-center justify-center transition-opacity duration-150 ease-out motion-reduce:transition-none ${
            checkboxVisible ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <span className="sr-only">Select {title}</span>
          <input
            checked={selected}
            className="size-4 rounded border-zinc-300"
            type="checkbox"
            onChange={onToggleSelect}
            onClick={(event) => event.stopPropagation()}
          />
        </label>
        {pinVisible ? (
          <button
            type="button"
            className="shrink-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800"
            aria-label={pinned ? "Unpin" : "Pin"}
            onClick={(event) => {
              event.stopPropagation();
              onTogglePin();
            }}
          >
            {pinned ? "Unpin" : "Pin"}
          </button>
        ) : null}
        <button
          type="button"
          className="group flex min-w-0 flex-1 items-center gap-3 text-left transition-colors hover:bg-zinc-50"
          onClick={onOpenInspect}
          aria-label={`Open ${title}`}
        >
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-zinc-200 text-sm font-semibold text-zinc-700 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
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
      </div>
    </li>
  );
}
