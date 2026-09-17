"use client";

import { type DragEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  cardSecondaryLine,
} from "@/domain/card-display";
import { itemListTitle, type Item } from "@/domain/item";
import type { LibraryLayout } from "@/domain/library-view";
import { itemMediaLayoutProps } from "./item-media-layout";
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
  layoutMode: LibraryLayout;
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
  layoutMode,
}: Props) {
  const title = itemListTitle(item);
  const secondary = cardSecondaryLine(item);
  const reduceMotion = useReducedMotion();

  const checkboxVisible = selected || selectionActive;

  return (
    <li
      draggable={dragEnabled}
      className={`group rounded-lg border border-border-edge bg-bg-surface transition-opacity duration-150 ease-out ${
        inspected || selected ? "ring-2 ring-border-focus" : ""
      } ${isDragging ? "opacity-50" : ""}`}
      onDragStart={onItemDragStart}
      onDragEnd={onItemDragEnd}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        <label
          className={`flex size-8 shrink-0 items-center justify-center ${
            checkboxVisible ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <span className="sr-only">Select {title}</span>
          <input
            checked={selected}
            className="size-4 rounded border-border-edge"
            type="checkbox"
            onChange={onToggleSelect}
            onClick={(event) => event.stopPropagation()}
          />
        </label>
        {pinVisible ? (
          <button
            type="button"
            className="shrink-0 rounded-md border border-border-edge bg-bg-surface px-2 py-1 text-xs font-medium text-text-primary"
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
          className="group flex min-w-0 flex-1 items-center gap-3 text-left transition-colors hover:bg-bg-canvas"
          onClick={onOpenInspect}
          aria-label={`Open ${title}`}
        >
          {inspected ? (
            <span className="size-10 shrink-0" aria-hidden />
          ) : (
            <motion.span
              className={`flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[8px] shadow-[0_0_0_1px_rgba(0,0,0,0.06)] ${
                item.type === "link"
                  ? "bg-bg-surface"
                  : "bg-bg-raised text-sm font-semibold text-text-primary"
              }`}
              style={{ borderRadius: 8 }}
              {...itemMediaLayoutProps(item.id, layoutMode, reduceMotion)}
            >
              <LibraryItemMedia
                item={item}
                compact
                className="!aspect-auto size-10"
              />
            </motion.span>
          )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-text-primary">
            {title}
          </span>
          {secondary ? (
            <span className="block truncate text-xs text-text-secondary">
              {secondary}
            </span>
          ) : null}
        </span>
        <span className="hidden shrink-0 items-center gap-3 text-xs text-text-secondary sm:flex">
          <span className="rounded bg-bg-raised px-1.5 py-0.5 font-medium text-text-secondary">
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
