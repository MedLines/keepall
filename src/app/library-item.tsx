"use client";

import {
  type DragEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { itemListTitle, type Item } from "@/domain/item";
import type { LibraryLayout } from "@/domain/library-view";
import {
  BROWSE_CHROME_FADE_S,
  useBrowseChromeVisible,
} from "./item-media-layout";
import { LibraryItemMedia } from "./library-item-media";
import { usePreviewEnrichViewport } from "./use-preview-enrich-viewport";
import { LibraryCardContent, LibraryCardMetadata } from "./library-card-content";
import { DeleteIcon, EditIcon, ImagesIcon, LayersIcon, MoreIcon, PinIcon, PlayIcon, SelectionCheckedIcon, SelectionEmptyIcon } from "./shell-icons";
import type { OrgNameSuggestion } from "./org-name-suggest";
import type { MasonryPlacement } from "./library-masonry";
import { LibraryListContent, LibraryListMetadata } from "./library-list-content";
import { ItemOrganizerDrawer } from "./item-organizer-drawer";
import {
  ImageItemEditDialog,
  LinkItemEditDialog,
  NoteItemEditDialog,
  VideoItemEditDialog,
  type ImageDetailsDraft,
  type LinkDetailsDraft,
  type NoteDetailsDraft,
  type VideoDetailsDraft,
} from "./item-edit-dialog";

export type PendingMutation =
  | { op: "save-note"; id: string }
  | { op: "save-link"; id: string }
  | { op: "save-image"; id: string }
  | { op: "save-video"; id: string }
  | { op: "append-image"; id: string }
  | { op: "replace-image-slide"; id: string }
  | { op: "delete"; id: string }
  | { op: "assign-tag"; id: string }
  | { op: "unassign-tag"; id: string }
  | { op: "assign-collection"; id: string }
  | { op: "create-collection" }
  | { op: "rename-collection"; id: string }
  | { op: "delete-collection"; id: string }
  | { op: "delete-tag"; id: string }
  | { op: "bulk-delete" }
  | { op: "bulk-assign-tag" }
  | { op: "bulk-unassign-tag" }
  | { op: "bulk-assign-collection" }
  | { op: "pin-item"; collectionId: string; itemId: string }
  | { op: "unpin-item"; collectionId: string; itemId: string };

export type LibraryItemProps = {
  placement?: MasonryPlacement;
  item: Item;
  inspected: boolean;
  openHref?: string;
  onOpenInspect: () => void;
  tagNames: { id: string; name: string }[];
  tagError: string | null;
  collections: { id: string; name: string }[];
  collectionError: string | null;
  editing: boolean;
  pendingDelete: boolean;
  mutationBusy: boolean;
  pendingMutation: PendingMutation | null;
  editError: string | null;
  onSaveNote: (draft: NoteDetailsDraft) => void;
  onSaveLink: (draft?: LinkDetailsDraft) => void;
  onSaveImage: (draft?: ImageDetailsDraft) => void;
  onSaveVideo: (draft: VideoDetailsDraft) => void;
  onCancelEdit: () => void;
  onAddTag: (name: string) => void;
  onAddCollection: (name: string) => void;
  onBrowseCollection: (collectionId: string) => void;
  onBrowseTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onStartEdit: () => void;
  onStartDelete: () => void;
  selected: boolean;
  selectionActive: boolean;
  onToggleSelect: () => void;
  tagSuggestions: OrgNameSuggestion[];
  collectionSuggestions: OrgNameSuggestion[];
  dragEnabled: boolean;
  isDragging: boolean;
  onItemDragStart: (event: DragEvent<HTMLElement>) => void;
  onItemDragEnd: () => void;
  pinVisible: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  layoutMode: LibraryLayout;
};

const ACTION_BTN =
  "ui-menu-item flex w-full items-center gap-2 text-left text-sm text-text-primary disabled:opacity-60";

function closeCardActionMenusOutside(target: EventTarget | null) {
  if (!(target instanceof Node)) return;
  document.querySelectorAll<HTMLDetailsElement>("details.library-card-actions[open]").forEach((menu) => {
    if (!menu.contains(target)) menu.open = false;
  });
}

export function LibraryItem({
  placement,
  item,
  inspected,
  openHref,
  onOpenInspect,
  tagNames,
  tagError,
  collections,
  collectionError,
  editing,
  pendingDelete,
  mutationBusy,
  pendingMutation,
  editError,
  onSaveNote,
  onSaveLink,
  onSaveImage,
  onSaveVideo,
  onCancelEdit,
  onAddTag,
  onAddCollection,
  onBrowseCollection,
  onBrowseTag,
  onRemoveTag,
  onStartEdit,
  onStartDelete,
  selected,
  selectionActive,
  onToggleSelect,
  tagSuggestions,
  collectionSuggestions,
  dragEnabled,
  isDragging,
  onItemDragStart,
  onItemDragEnd,
  pinVisible,
  pinned,
  onTogglePin,
  layoutMode,
}: LibraryItemProps) {
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [organizerSide, setOrganizerSide] = useState<"left" | "right">("right");
  const [imageRatio, setImageRatio] = useState(1.6);
  const actionsRef = useRef<HTMLDetailsElement>(null);
  const reduceMotion = useReducedMotion();

  const checkboxVisible = selected || selectionActive;
  const availableTagSuggestions = tagSuggestions.filter(
    (entry) => !item.tagIds.includes(entry.id),
  );
  const availableCollectionSuggestions = collectionSuggestions.filter(
    (entry) => !item.collectionIds.includes(entry.id),
  );

  const title = itemListTitle(item);
  const isList = layoutMode === "list";
  const hasGridFooter = item.type !== "image" || Boolean(
    item.title.trim() || item.caption.trim() || item.sourceUrl ||
    (pinVisible && pinned) || collections.length || tagNames.length || pendingDelete
  );
  const hasMedia = item.type === "image" || item.type === "link" || item.type === "video";
  const rowRef = useRef<HTMLLIElement>(null);
  const measureElement = placement?.measureElement;
  const setRowRef = useCallback((node: HTMLLIElement | null) => {
    rowRef.current = node;
    measureElement?.(node);
  }, [measureElement]);
  usePreviewEnrichViewport(
    rowRef,
    item.type === "link" ? item : null,
  );

  const chromeVisible = useBrowseChromeVisible(layoutMode, reduceMotion);
  const chromeMotion = {
    initial: false as const,
    animate: { opacity: chromeVisible ? 1 : 0 },
    transition: {
      duration: chromeVisible ? BROWSE_CHROME_FADE_S.in : BROWSE_CHROME_FADE_S.out,
      ease: "easeOut" as const,
    },
  };

  /* Cover morphs; sizing on the motion node only (avoids double-box stretch). */
  const mediaSlot = (
    <div
      className={
        isList
          ? "library-list-thumbnail relative shrink-0 overflow-hidden rounded-lg bg-bg-raised"
          : `library-card-media squircle-panel relative ${hasGridFooter && (item.type === "link" || !openHref) ? "mb-3" : ""}`
      }
    >
      {inspected ? (
        <div
          className={isList ? "size-full" : "w-full"}
          style={isList ? undefined : { aspectRatio: imageRatio }}
          aria-hidden
        />
      ) : (
        <div
          className={
            isList
              ? "size-full"
              : item.type === "link"
                ? "w-full"
                : "w-full cursor-pointer"
          }
          onClick={
            isList || item.type === "link" || openHref
              ? undefined
              : onOpenInspect
          }
          onKeyDown={
            isList || item.type === "link" || openHref
              ? undefined
              : (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenInspect();
                  }
                }
          }
          role={isList || item.type === "link" || openHref ? undefined : "button"}
          tabIndex={isList || item.type === "link" || openHref ? undefined : 0}
          aria-label={
            isList || item.type === "link" || openHref ? undefined : `Open ${title}`
          }
        >
          <LibraryItemMedia
            item={item}
            variant={isList ? "card" : "grid"}
            compact={isList}
            onImageLoad={setImageRatio}
            className={isList ? "!aspect-auto h-full w-full object-cover" : ""}
          />
        </div>
      )}
      {!isList && item.type === "link" && !inspected ? (
        <a
          aria-label={title}
          className="absolute inset-0 z-[1]"
          draggable={false}
          href={item.url}
          rel="noreferrer"
          target="_blank"
        />
      ) : null}
      {item.type === "video" && !inspected ? (
        <span data-testid="video-play-overlay" aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <span className={`grid place-items-center rounded-full border border-white/45 bg-black/30 text-white/85 shadow-md ${isList ? "size-9" : "size-16"}`}>
            <PlayIcon className={isList ? "size-5" : "size-8"} />
          </span>
        </span>
      ) : null}
      {!isList && item.type === "image" && item.assetIds.length > 1 && !inspected ? (
        <span
          className="library-card-media-chrome pointer-events-none absolute bottom-2 end-2 z-10 flex min-h-11 items-center gap-1.5 px-3 text-xs font-medium tabular-nums"
          aria-label={`${item.assetIds.length} images`}
        >
          <ImagesIcon className="size-4" />
          {item.assetIds.length}
        </span>
      ) : null}
    </div>
  );

  const cardActions = !inspected && !editing && !pendingDelete ? (
    <details
      ref={actionsRef}
      name="library-card-actions"
      className={`library-card-actions absolute z-30 ${isList ? "end-0 top-5" : "end-4 top-4"}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && actionsRef.current) {
          event.preventDefault();
          actionsRef.current.open = false;
          actionsRef.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary
        aria-label={`Actions for ${title}`}
        className={`relative flex cursor-pointer list-none items-center justify-center text-text-secondary hover:text-text-primary [&::-webkit-details-marker]:hidden ${isList ? "size-10 rounded-control hover:bg-bg-raised" : "library-card-media-chrome size-11"}`}
      >
        <MoreIcon />
      </summary>
          <div
            className="ui-popover absolute end-0 mt-2 flex w-56 max-w-[calc(100vw-5rem)] flex-col gap-2"
          >
            <div className="flex flex-col">
              {pinVisible ? (
                <button
                  type="button"
                  className={ACTION_BTN}
                  aria-label={pinned ? "Unpin" : "Pin"}
                  disabled={mutationBusy}
                  onClick={onTogglePin}
                >
                  <PinIcon />
                  {pendingMutation?.op === "pin-item" &&
                  pendingMutation.itemId === item.id
                    ? "…"
                    : pendingMutation?.op === "unpin-item" &&
                        pendingMutation.itemId === item.id
                      ? "…"
                      : pinned
                        ? "Unpin"
                        : "Pin"}
                </button>
              ) : null}
              <button
                type="button"
                className={ACTION_BTN}
                data-focus-return={`edit:${item.id}`}
                disabled={mutationBusy}
                onClick={() => {
                  if (actionsRef.current) actionsRef.current.open = false;
                  onStartEdit();
                }}
              >
                <EditIcon /> Edit
              </button>
              <button
                type="button"
                className={ACTION_BTN}
                aria-label="Delete"
                data-focus-return={`delete:${item.id}`}
                disabled={mutationBusy}
                onClick={onStartDelete}
              >
                <DeleteIcon /> Delete
              </button>
              <button
                type="button"
                className={ACTION_BTN}
                aria-label="Organize"
                disabled={mutationBusy}
                onClick={() => {
                  setOrganizerSide(
                    document.documentElement.dir === "rtl" ? "left" : "right",
                  );
                  if (actionsRef.current) actionsRef.current.open = false;
                  setOrganizerOpen(true);
                }}
              >
                <LayersIcon /> Organize
              </button>
            </div>
          </div>
    </details>
  ) : null;

  const assignedCollections = item.collectionIds
    .map((id) => collectionSuggestions.find((entry) => entry.id === id))
    .filter((entry): entry is OrgNameSuggestion => Boolean(entry));

  return (
    <li
      ref={setRowRef}
      style={placement?.style}
      data-index={placement?.index}
      data-item-id={item.id}
      draggable={dragEnabled}
      className={`library-item-root min-w-0 focus-within:z-10 has-[details[open]]:z-10 ${isList ? "@container" : ""} ${isDragging ? "opacity-50" : ""}`}
      onPointerDownCapture={(event) => closeCardActionMenusOutside(event.target)}
      onFocusCapture={(event) => closeCardActionMenusOutside(event.target)}
      onDragStart={onItemDragStart}
      onDragEnd={onItemDragEnd}
    >
      <ItemOrganizerDrawer
        open={organizerOpen}
        onOpenChange={(open) => {
          setOrganizerOpen(open);
          if (!open) {
            window.requestAnimationFrame(() => {
              actionsRef.current?.querySelector("summary")?.focus();
            });
          }
        }}
        side={organizerSide}
        itemTitle={title}
        tags={tagNames}
        collections={assignedCollections}
        tagSuggestions={availableTagSuggestions}
        collectionSuggestions={availableCollectionSuggestions}
        disabled={mutationBusy}
        pendingTag={
          pendingMutation?.op === "assign-tag" &&
          pendingMutation.id === item.id
        }
        pendingCollection={
          pendingMutation?.op === "assign-collection" &&
          pendingMutation.id === item.id
        }
        tagError={tagError}
        collectionError={collectionError}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        onMoveToCollection={onAddCollection}
      />
      {item.type === "image" && editing ? (
        <ImageItemEditDialog
          item={item}
          open
          busy={
            pendingMutation?.op === "save-image" &&
            pendingMutation.id === item.id
          }
          error={editError}
          onSave={onSaveImage}
          onOpenChange={(open) => {
            if (!open) onCancelEdit();
          }}
        />
      ) : null}
      {item.type === "video" && editing ? (
        <VideoItemEditDialog
          item={item}
          open
          busy={pendingMutation?.op === "save-video" && pendingMutation.id === item.id}
          error={editError}
          onSave={onSaveVideo}
          onOpenChange={(open) => { if (!open) onCancelEdit(); }}
        />
      ) : null}
      {item.type === "link" && editing ? (
        <LinkItemEditDialog
          item={item}
          open
          busy={pendingMutation?.op === "save-link" && pendingMutation.id === item.id}
          error={editError}
          onSave={onSaveLink}
          onOpenChange={(open) => { if (!open) onCancelEdit(); }}
        />
      ) : null}
      {item.type === "note" && editing ? (
        <NoteItemEditDialog
          item={item}
          open
          busy={pendingMutation?.op === "save-note" && pendingMutation.id === item.id}
          error={editError}
          onSave={onSaveNote}
          onOpenChange={(open) => { if (!open) onCancelEdit(); }}
        />
      ) : null}
      <div
        data-selected={selected || undefined}
        className={
          isList
            ? "library-list-row group relative flex items-start gap-3 rounded-control-lg border-b border-border-edge px-3 py-4"
            : "library-card squircle-panel group relative flex flex-col rounded-card p-card-inset"
        }
      >
      {cardActions}
      <label
        data-visible={checkboxVisible}
        className={
          isList
            ? `library-list-select absolute start-1 top-5 z-20 flex size-8 items-center justify-center rounded-md bg-bg-surface/95 shadow-edge ${editing || pendingDelete ? "hidden" : ""}`
            : `library-card-media-chrome absolute start-4 top-4 z-20 flex size-11 items-center justify-center ${
                !chromeVisible
                  ? "pointer-events-none opacity-0"
                  : checkboxVisible
                    ? "pointer-events-auto opacity-100"
                    : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
              }`
        }
      >
        <span className="sr-only">Select {title}</span>
        <input
          checked={selected}
          className="peer sr-only"
          disabled={mutationBusy}
          type="checkbox"
          onChange={onToggleSelect}
          onClick={(event) => event.stopPropagation()}
        />
        <span
          aria-hidden="true"
          className="flex size-5 items-center justify-center rounded-full peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-border-focus"
          data-selection-indicator={selected ? "checked" : "empty"}
        >
          {selected ? (
            <SelectionCheckedIcon className="size-5" />
          ) : (
            <SelectionEmptyIcon className="size-5" />
          )}
        </span>
      </label>
      {isList ? !pendingDelete ? (
        item.type === "link" ? (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${title}`}
            className="shrink-0 rounded-lg"
          >
            {mediaSlot}
          </a>
        ) : openHref ? (
          <Link
            href={openHref}
            prefetch={false}
            aria-label={`Open ${title}`}
            className="shrink-0 rounded-lg"
          >
            {mediaSlot}
          </Link>
        ) : (
          <button type="button" onClick={onOpenInspect} aria-label={`Preview ${title}`} className="shrink-0 rounded-lg">{mediaSlot}</button>
        )
      ) : null : hasMedia ? (
        openHref && item.type !== "link" ? (
          <Link
            href={openHref}
            prefetch={false}
            aria-label={`Open ${title}`}
            className={`block ${hasGridFooter ? "mb-5" : ""}`}
          >
            {mediaSlot}
          </Link>
        ) : mediaSlot
      ) : null}
      <motion.div
        {...chromeMotion}
        hidden={!isList && !hasGridFooter}
        className={
          isList
            ? `min-w-0 flex-1 ${pendingDelete ? "" : "library-list-body"}`
            : item.type === "image" ? "px-2 pb-1" : hasMedia ? "px-4 pb-3 pt-3" : "px-4 pb-3 pt-4"
        }
        style={{ pointerEvents: chromeVisible ? "auto" : "none" }}
      >
        {!isList ? (
          <LibraryCardContent
            item={item}
            onOpen={onOpenInspect}
            openHref={openHref}
            pinned={pinVisible && pinned}
          />
        ) : (
          <div className={isList ? "min-w-0 flex-1 text-left" : undefined}>
            {isList && !pendingDelete ? (
              <LibraryListContent item={item} pinned={pinVisible && pinned} onOpen={onOpenInspect} openHref={openHref} />
            ) : <p className="text-sm font-medium">{title}</p>}
          </div>
        )}
        {isList && !pendingDelete ? <LibraryListMetadata collections={collections} tags={tagNames} onBrowseCollection={onBrowseCollection} onBrowseTag={onBrowseTag} /> : null}

        {!isList && !pendingDelete ? (
          <LibraryCardMetadata
            collections={collections}
            tags={tagNames}
            onBrowseCollection={onBrowseCollection}
            onBrowseTag={onBrowseTag}
            onRemoveTag={onRemoveTag}
          />
        ) : null}
      </motion.div>
      </div>
    </li>
  );
}
