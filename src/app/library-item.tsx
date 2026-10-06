"use client";

import {
  type DragEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { itemActionLabel } from "@/domain/item-label";
import { itemListTitle, type Item } from "@/domain/item";
import type { LibraryLayout } from "@/domain/library-view";
import type { SearchExcerpt } from "@/domain/search";
import {
  BROWSE_CHROME_FADE_S,
  useBrowseChromeVisible,
} from "./item-media-layout";
import { LibraryItemMedia } from "./library-item-media";
import { usePreviewEnrichViewport } from "./use-preview-enrich-viewport";
import { LibrarySelectionControl } from "./library-selection-control";
import { LibraryCardContent, LibraryCardMetadata } from "./library-card-content";
import { DeleteIcon, MoreIcon, PlayIcon } from "./shell-icons";
import { ItemTypeBadge } from "./item-type-icon";
import type { OrgNameSuggestion } from "./org-name-suggest";
import type { MasonryPlacement } from "./library-masonry";
import { LibraryListContent, LibraryListMetadata } from "./library-list-content";
import { ItemOrganizerDrawer } from "./item-organizer-drawer";
import { ItemContextMenu } from "./item-context-menu";
import { requestManualPreviewEnrich } from "./preview-enrich-coordinator";
import {
  ImageItemEditDialog,
  LinkItemEditDialog,
  NoteItemEditDialog,
  VideoItemEditDialog,
  DocumentItemEditDialog,
  type ImageDetailsDraft,
  type LinkDetailsDraft,
  type NoteDetailsDraft,
  type VideoDetailsDraft,
  type DocumentDetailsDraft,
} from "./item-edit-dialog";

export type PendingMutation =
  | { op: "save-note"; id: string }
  | { op: "save-link"; id: string }
  | { op: "save-image"; id: string }
  | { op: "save-video"; id: string }
  | { op: "save-document"; id: string }
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
  | { op: "bulk-clear-collection" }
  | { op: "pin-item"; collectionId: string; itemId: string }
  | { op: "unpin-item"; collectionId: string; itemId: string };

export type LibraryItemProps = {
  placement?: MasonryPlacement;
  item: Item;
  searchQuery?: string;
  searchExcerpt?: SearchExcerpt;
  trashActions?: { onRestore: () => void; onDelete: () => void };
  inspected: boolean;
  openHref?: string;
  onOpenInspect: () => void;
  onPreview?: () => void;
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
  onSaveDocument: (draft: DocumentDetailsDraft) => void;
  onCancelEdit: () => void;
  onAddTag: (name: string) => void;
  onAddCollection: (name: string) => void;
  onClearCollection: () => void;
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

export function LibraryItem({
  placement,
  item,
  searchQuery = "",
  searchExcerpt,
  trashActions,
  inspected,
  openHref,
  onOpenInspect,
  onPreview,
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
  onSaveDocument,
  onCancelEdit,
  onAddTag,
  onAddCollection,
  onClearCollection,
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
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const actionsRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  const checkboxVisible = selected || selectionActive;
  const availableTagSuggestions = tagSuggestions.filter(
    (entry) => !item.tagIds.includes(entry.id),
  );
  const availableCollectionSuggestions = collectionSuggestions.filter(
    (entry) => !item.collectionIds.includes(entry.id),
  );

  const title = itemListTitle(item);
  const actionLabel = itemActionLabel(item);
  const isList = layoutMode === "list";
  const hasGridFooter = item.type !== "image" || Boolean(
    trashActions || searchQuery.trim() || item.title.trim() || item.caption.trim() || item.sourceUrl ||
    (pinVisible && pinned) || collections.length || tagNames.length || pendingDelete
  );
  const isPdf = item.type === "document" && item.format === "pdf";
  const hasMedia = item.type === "image" || item.type === "link" || item.type === "video" || isPdf;
  const rowRef = useRef<HTMLLIElement>(null);
  const measureElement = placement?.measureElement;
  const setRowRef = useCallback((node: HTMLLIElement | null) => {
    rowRef.current = node;
    measureElement?.(node);
  }, [measureElement]);
  usePreviewEnrichViewport(
    rowRef,
    !trashActions && item.type === "link" ? item : null,
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
          : "library-card-media squircle-panel relative"
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
                : trashActions ? "w-full" : "w-full cursor-pointer"
          }
          onClick={
            trashActions || isList || item.type === "link" || openHref
              ? undefined
              : onOpenInspect
          }
          onKeyDown={
            trashActions || isList || item.type === "link" || openHref
              ? undefined
              : (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenInspect();
                  }
                }
          }
          role={trashActions || isList || item.type === "link" || openHref ? undefined : "button"}
          tabIndex={trashActions || isList || item.type === "link" || openHref ? undefined : 0}
          aria-label={
            trashActions || isList || item.type === "link" || openHref ? undefined : `Open ${title}`
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
      {!isList && hasMedia && !inspected ? <ItemTypeBadge item={item} /> : null}
    </div>
  );

  const cardActions = !inspected && !editing && !pendingDelete ? (
    <button type="button"
      ref={actionsRef}
      aria-label={`Actions for ${actionLabel}`}
      data-item-actions={item.id}
      disabled={mutationBusy}
      className={`library-card-actions absolute z-30 flex cursor-pointer items-center justify-center text-text-secondary hover:text-text-primary disabled:cursor-default ${isList ? "end-0 top-5 size-10 rounded-control hover:bg-bg-raised" : "library-card-media-chrome library-card-corner-control library-card-corner-end"}`}
    >
      <MoreIcon className="size-4" />
    </button>
  ) : null;

  const assignedCollections = item.collectionIds
    .map((id) => collectionSuggestions.find((entry) => entry.id === id))
    .filter((entry): entry is OrgNameSuggestion => Boolean(entry));

  return (
    <ItemContextMenu
      trashActions={trashActions}
      title={actionLabel}
      trigger={cardActions}
      openHref={item.type === "link" ? item.url : openHref}
      tags={tagSuggestions}
      assignedTagIds={item.tagIds}
      collections={collectionSuggestions}
      assignedCollectionIds={item.collectionIds}
      collectionError={collectionError}
      onMoveToCollection={onAddCollection}
      onClearCollection={onClearCollection}
      triggerRef={actionsRef}
      busy={mutationBusy}
      disabled={inspected || editing || pendingDelete}
      tagError={tagError}
      onAddTag={onAddTag}
      onRemoveTag={onRemoveTag}
      onPreview={onPreview}
      onFetchPreview={item.type === "link" && !trashActions ? () => {
        if (fetchingPreview || item.previewStatus === "pending") return;
        setFetchingPreview(true);
        void requestManualPreviewEnrich(item.id, item.url).finally(() => setFetchingPreview(false));
      } : undefined}
      fetchingPreview={fetchingPreview || (item.type === "link" && item.previewStatus === "pending")}
      hasPreview={item.type === "link" && (item.previewStatus === "ready" || Boolean(item.previewTitle || item.previewDescription || item.previewAssetId))}
      onEdit={onStartEdit}
      onDelete={onStartDelete}
      onTogglePin={pinVisible ? onTogglePin : undefined}
      pinned={pinned}
      onOrganize={() => {
        setOrganizerSide(document.documentElement.dir === "rtl" ? "left" : "right");
        setOrganizerOpen(true);
      }}
    >
    {(trigger) => <li
      ref={setRowRef}
      style={placement?.style}
      data-index={placement?.index}
      data-item-id={item.id}
      data-selection-active={selectionActive || undefined}
      tabIndex={0}
      aria-label={title}
      aria-description="Arrow keys browse in result order. Shift and an arrow selects a range. Space previews. Enter opens the full item."
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Space Enter Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp Shift+ArrowDown"
      draggable={dragEnabled}
      className={`library-item-root min-w-0 rounded-control-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-focus focus-within:z-10 ${isList ? "@container" : ""} ${isDragging ? "opacity-50" : ""}`}
      onDragStart={onItemDragStart}
      onDragEnd={onItemDragEnd}
      onClickCapture={event => {
        if (!selectionActive || (event.target as HTMLElement).closest("label[data-visible], [data-item-actions]")) return;
        if (!event.currentTarget.contains(event.target as Node)) return;
        event.preventDefault();
        event.stopPropagation();
        if (!mutationBusy) onToggleSelect();
      }}
    >
      <ItemOrganizerDrawer
        open={organizerOpen}
        onOpenChange={(open) => {
          setOrganizerOpen(open);
          if (!open) {
            window.requestAnimationFrame(() => {
              actionsRef.current?.focus();
            });
          }
        }}
        side={organizerSide}
        itemTitle={actionLabel}
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
        onMoveToUnsorted={onClearCollection}
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
      {item.type === "document" && editing ? (
        <DocumentItemEditDialog item={item} open error={editError}
          busy={pendingMutation?.op === "save-document" && pendingMutation.id === item.id}
          onSave={onSaveDocument} onOpenChange={(open) => { if (!open) onCancelEdit(); }}
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
            : `library-card squircle-panel group relative flex flex-col rounded-card pt-[8px] pr-[8px] pl-[8px] ${hasGridFooter ? "pb-[2px]" : "pb-[8px]"}`
        }
      >
      {trigger}
      <LibrarySelectionControl
        label={`Select ${title}`}
        visible={checkboxVisible}
        selected={selected}
        disabled={mutationBusy}
        onToggle={onToggleSelect}
        className={
          isList
            ? `library-list-select absolute start-1 top-5 z-20 flex size-8 items-center justify-center rounded-md bg-bg-surface/95 shadow-edge ${editing || pendingDelete ? "hidden" : ""}`
            : `library-card-media-chrome library-card-corner-control library-card-corner-start absolute z-20 flex items-center justify-center ${
                !chromeVisible
                  ? "pointer-events-none opacity-0"
                  : checkboxVisible
                    ? "pointer-events-auto opacity-100"
                    : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
              }`
        }
      />
      {isList ? trashActions ? <div className="shrink-0 rounded-lg">{mediaSlot}</div> : !pendingDelete ? (
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
        !trashActions && openHref && item.type !== "link" ? (
          <Link
            href={openHref}
            prefetch={false}
            aria-label={`Open ${title}`}
            className="block"
          >
            {mediaSlot}
          </Link>
        ) : mediaSlot
      ) : null}
      <motion.div
        {...chromeMotion}
        inert={selectionActive}
        hidden={!isList && !hasGridFooter}
        className={
          isList
            ? `min-w-0 flex-1 ${pendingDelete ? "" : "library-list-body"}`
            : `library-card-footer ${hasMedia ? "library-card-footer-with-media" : ""}`
        }
        style={{ pointerEvents: chromeVisible ? "auto" : "none" }}
      >
        {!isList ? (
          <LibraryCardContent
            item={item}
            query={searchQuery}
            searchExcerpt={searchExcerpt}
            tagNames={tagNames.map(tag => tag.name)}
            onOpen={onOpenInspect}
            openHref={trashActions ? undefined : openHref}
            pinned={pinVisible && pinned}
          />
        ) : (
          <div className={isList ? "min-w-0 flex-1 text-left" : undefined}>
            {isList && !pendingDelete ? (
              <LibraryListContent query={searchQuery} searchExcerpt={searchExcerpt} tagNames={tagNames.map(tag => tag.name)} item={item} pinned={pinVisible && pinned} onOpen={onOpenInspect} openHref={trashActions ? undefined : openHref} />
            ) : <p className="text-sm font-medium">{title}</p>}
          </div>
        )}
        {isList && !pendingDelete && !trashActions ? <LibraryListMetadata collections={collections} tags={tagNames} onBrowseCollection={onBrowseCollection} onBrowseTag={onBrowseTag} /> : null}

        {!isList && !pendingDelete && !trashActions ? (
          <LibraryCardMetadata
            collections={collections}
            tags={tagNames}
            onBrowseCollection={onBrowseCollection}
            onBrowseTag={onBrowseTag}
            onRemoveTag={onRemoveTag}
          />
        ) : null}
        {trashActions ? <>
          {(collections.length > 0 || tagNames.length > 0) ? <p className="mt-2 truncate text-xs text-text-secondary">{[...collections, ...tagNames].map((entry) => entry.name).join(" · ")}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={mutationBusy} onClick={trashActions.onRestore} className="ui-control inline-flex min-h-10 items-center justify-center px-3 text-sm disabled:opacity-50">Restore</button>
            <button type="button" disabled={mutationBusy} onClick={trashActions.onDelete} className="ui-control inline-flex min-h-10 items-center justify-center gap-2 px-3 text-sm text-text-danger disabled:opacity-50"><DeleteIcon className="size-4" /><span className="leading-none">Delete permanently</span></button>
          </div>
        </> : null}
      </motion.div>
      </div>
    </li>}
    </ItemContextMenu>
  );
}
