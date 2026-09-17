"use client";

import {
  type DragEvent,
  type KeyboardEvent,
  type Ref,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import { itemListTitle, type Item } from "@/domain/item";
import type { LibraryLayout } from "@/domain/library-view";
import {
  BROWSE_CHROME_FADE_S,
  itemMediaLayoutProps,
  useBrowseChromeVisible,
} from "./item-media-layout";
import { LibraryItemMedia } from "./library-item-media";
import { usePreviewEnrichViewport } from "./use-preview-enrich-viewport";
import { LibraryCardContent, LibraryCardMetadata } from "./library-card-content";
import { CollectionIcon, DeleteIcon, EditIcon, HashIcon, MoreIcon, PinIcon } from "./shell-icons";
import { OrgNameSuggest, type OrgNameSuggestion } from "./org-name-suggest";
import type { MasonryPlacement } from "./library-masonry";
import { LibraryListContent, LibraryListMetadata } from "./library-list-content";

export type PendingMutation =
  | { op: "save-note"; id: string }
  | { op: "save-link"; id: string }
  | { op: "save-image"; id: string }
  | { op: "append-image"; id: string }
  | { op: "replace-image-slide"; id: string }
  | { op: "delete"; id: string }
  | { op: "assign-tag"; id: string }
  | { op: "unassign-tag"; id: string }
  | { op: "assign-collection"; id: string }
  | { op: "create-collection" }
  | { op: "rename-collection"; id: string }
  | { op: "delete-collection"; id: string }
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
  onOpenInspect: () => void;
  tagNames: { id: string; name: string }[];
  tagError: string | null;
  collectionNames: string[];
  collectionError: string | null;
  editing: boolean;
  pendingDelete: boolean;
  mutationBusy: boolean;
  pendingMutation: PendingMutation | null;
  editDraft: string;
  editTitleDraft: string;
  editError: string | null;
  setFirstEditField: (
    node: HTMLTextAreaElement | HTMLInputElement | null,
  ) => void;
  confirmDeleteRef: Ref<HTMLButtonElement | null>;
  onEditDraftChange: (value: string) => void;
  onEditTitleChange: (value: string) => void;
  onEditSaveShortcut: (
    event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
    save: () => void,
  ) => void;
  onSaveNote: () => void;
  onSaveLink: () => void;
  onSaveImage: () => void;
  onCancelEdit: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onAddTag: (name: string) => void;
  onAddCollection: (name: string) => void;
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
  "flex min-h-10 w-full items-center gap-2 rounded-control px-2 text-left text-sm text-text-primary hover:bg-bg-raised disabled:opacity-60";

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
  onOpenInspect,
  tagNames,
  tagError,
  collectionNames,
  collectionError,
  editing,
  pendingDelete,
  mutationBusy,
  pendingMutation,
  editDraft,
  editTitleDraft,
  editError,
  setFirstEditField,
  confirmDeleteRef,
  onEditDraftChange,
  onEditTitleChange,
  onEditSaveShortcut,
  onSaveNote,
  onSaveLink,
  onSaveImage,
  onCancelEdit,
  onConfirmDelete,
  onCancelDelete,
  onAddTag,
  onAddCollection,
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
  const [tagDraft, setTagDraft] = useState("");
  const [collectionDraft, setCollectionDraft] = useState("");
  const [orgPanel, setOrgPanel] = useState<"tag" | "collection" | null>(null);
  const [imageRatio, setImageRatio] = useState(1.6);
  const [failedPreview, setFailedPreview] = useState<string | null>(null);
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
  const previewKey = item.type === "link"
    ? `${item.previewAssetId}:${item.previewImageUrl}`
    : "";
  const hasMedia = item.type === "image" || (
    item.type === "link" &&
    failedPreview !== previewKey &&
    Boolean(item.previewAssetId || (item.previewStatus === "ready" && item.previewImageUrl))
  );
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

  useEffect(() => {
    if (editing || pendingDelete) {
      setOrgPanel(null);
    }
  }, [editing, pendingDelete]);

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
          ? "library-list-thumbnail relative shrink-0"
          : "relative mb-3 w-full"
      }
    >
      {inspected ? (
        <div
          className={isList ? "size-full" : "w-full"}
          style={isList ? undefined : { aspectRatio: imageRatio }}
          aria-hidden
        />
      ) : (
        <motion.div
          {...itemMediaLayoutProps(item.id, layoutMode, reduceMotion)}
          className={
            isList
              ? "size-full overflow-hidden bg-bg-raised"
              : item.type === "link"
                ? "w-full overflow-hidden bg-bg-surface"
                : "w-full cursor-pointer overflow-hidden bg-bg-raised"
          }
          style={{ borderRadius: isList ? 8 : 12 }}
          onClick={
            isList || item.type === "link"
              ? undefined
              : onOpenInspect
          }
          onKeyDown={
            isList || item.type === "link"
              ? undefined
              : (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenInspect();
                  }
                }
          }
          role={isList || item.type === "link" ? undefined : "button"}
          tabIndex={isList || item.type === "link" ? undefined : 0}
          aria-label={
            isList || item.type === "link" ? undefined : `Open ${title}`
          }
        >
          <LibraryItemMedia
            item={item}
            variant={isList ? "card" : "grid"}
            compact={isList}
            onImageLoad={setImageRatio}
            onPreviewUnavailable={() => setFailedPreview(previewKey)}
            className={isList ? "!aspect-auto h-full w-full object-cover" : ""}
          />
        </motion.div>
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
    </div>
  );

  const cardActions = !inspected && !editing && !pendingDelete ? (
    <details
      ref={actionsRef}
      name="library-card-actions"
      className={`library-card-actions absolute z-30 ${isList ? "end-0 top-5" : "end-3 top-3"}`}
      onToggle={(event) => {
        if (!event.currentTarget.open) setOrgPanel(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && actionsRef.current) {
          event.preventDefault();
          actionsRef.current.open = false;
          setOrgPanel(null);
          actionsRef.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary
        aria-label={`Actions for ${title}`}
        className={`relative flex cursor-pointer list-none items-center justify-center rounded-control text-text-secondary hover:text-text-primary [&::-webkit-details-marker]:hidden ${isList ? "size-10 hover:bg-bg-raised" : "size-8 bg-bg-surface/95 shadow-edge after:absolute after:-inset-1"}`}
      >
        <MoreIcon />
      </summary>
          <div
            className="absolute end-0 mt-2 flex w-56 max-w-[calc(100vw-5rem)] flex-col gap-2 rounded-control bg-bg-surface p-2 shadow-menu ring-1 ring-border-edge"
          >
            <div className="flex flex-col">
              {pinVisible ? (
                <button
                  type="button"
                  className={ACTION_BTN}
                  aria-label={pinned ? "Unpin" : "Pin"}
                  disabled={mutationBusy}
                  onClick={() => {
                    setOrgPanel(null);
                    onTogglePin();
                  }}
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
                  setOrgPanel(null);
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
                onClick={() => {
                  setOrgPanel(null);
                  onStartDelete();
                }}
              >
                <DeleteIcon /> Delete
              </button>
              <button
                type="button"
                className={ACTION_BTN}
                aria-expanded={orgPanel === "tag"}
                aria-label="Add tag"
                disabled={mutationBusy}
                onClick={() =>
                  setOrgPanel((panel) => (panel === "tag" ? null : "tag"))
                }
              >
                <HashIcon /> Add tag
              </button>
              <button
                type="button"
                className={ACTION_BTN}
                aria-expanded={orgPanel === "collection"}
                aria-label="Add to collection"
                disabled={mutationBusy}
                onClick={() =>
                  setOrgPanel((panel) =>
                    panel === "collection" ? null : "collection",
                  )
                }
              >
                <CollectionIcon /> Move to collection
              </button>
            </div>
            {orgPanel === "tag" ? (
              <div className="min-w-0 p-1">
                <OrgNameSuggest
                  compact
                  hideLabel
                  inputId={`add-tag-${item.id}`}
                  label="Add tag"
                  placeholder="Tag name"
                  value={tagDraft}
                  suggestions={availableTagSuggestions}
                  disabled={mutationBusy}
                  pending={
                    pendingMutation?.op === "assign-tag" &&
                    pendingMutation.id === item.id
                  }
                  error={tagError}
                  onChange={setTagDraft}
                  onCancel={() => setOrgPanel(null)}
                  onSubmit={(name) => {
                    onAddTag(name);
                    setTagDraft("");
                  }}
                />
              </div>
            ) : null}
            {orgPanel === "collection" ? (
              <div className="min-w-0 p-1">
                <OrgNameSuggest
                  compact
                  hideLabel
                  inputId={`add-collection-${item.id}`}
                  label="Add to collection"
                  placeholder="Collection"
                  value={collectionDraft}
                  suggestions={availableCollectionSuggestions}
                  disabled={mutationBusy}
                  pending={
                    pendingMutation?.op === "assign-collection" &&
                    pendingMutation.id === item.id
                  }
                  error={collectionError}
                  onChange={setCollectionDraft}
                  onCancel={() => setOrgPanel(null)}
                  onSubmit={(name) => {
                    onAddCollection(name);
                    setCollectionDraft("");
                    setOrgPanel(null);
                  }}
                />
              </div>
            ) : null}
          </div>
    </details>
  ) : null;

  return (
    <li
      ref={setRowRef}
      style={placement?.style}
      data-index={placement?.index}
      draggable={dragEnabled}
      className={`library-item-root min-w-0 focus-within:z-10 has-[details[open]]:z-10 ${isList ? "@container" : ""} ${isDragging ? "opacity-50" : ""}`}
      onPointerDownCapture={(event) => closeCardActionMenusOutside(event.target)}
      onFocusCapture={(event) => closeCardActionMenusOutside(event.target)}
      onDragStart={onItemDragStart}
      onDragEnd={onItemDragEnd}
    >
      <div
        className={
          isList
            ? `library-list-row group relative flex items-start gap-3 border-b border-border-edge py-4 ${
                selected ? "bg-bg-raised" : ""
              }`
            : `library-card group relative flex flex-col rounded-panel p-2 ${
                selected ? "outline-2 outline-border-focus" : ""
              }`
        }
      >
      {cardActions}
      {!isList && pinVisible && pinned ? (
        <span title="Pinned in this collection" className="absolute end-14 top-3 z-20 flex size-8 items-center justify-center rounded-control bg-bg-surface/95 text-text-primary">
          <PinIcon />
          <span className="sr-only">Pinned in this collection</span>
        </span>
      ) : null}
      <label
        data-visible={checkboxVisible}
        className={
          isList
            ? `library-list-select absolute start-1 top-5 z-20 flex size-8 items-center justify-center rounded-md bg-bg-surface/95 shadow-edge ${editing || pendingDelete ? "hidden" : ""}`
            : `absolute start-3 top-3 z-20 flex size-8 items-center justify-center rounded-md bg-bg-surface/95 shadow-[0_0_0_1px_rgba(0,0,0,0.06)] transition-opacity duration-100 ${
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
          className="size-4 rounded border-border-edge"
          disabled={mutationBusy}
          type="checkbox"
          onChange={onToggleSelect}
          onClick={(event) => event.stopPropagation()}
        />
      </label>
      {isList ? !editing && !pendingDelete ? <button type="button" onClick={onOpenInspect} aria-label={`Preview ${title}`} className="shrink-0 rounded-lg">{mediaSlot}</button> : null : hasMedia ? mediaSlot : null}
      <motion.div
        {...chromeMotion}
        className={
          isList
            ? `min-w-0 flex-1 ${editing || pendingDelete ? "" : "library-list-body"}`
            : hasMedia ? "px-2 pb-1" : "px-2 pb-1 pt-3"
        }
        style={{ pointerEvents: chromeVisible ? "auto" : "none" }}
      >
        {!isList && !editing ? (
          <LibraryCardContent item={item} onOpen={onOpenInspect} />
        ) : (
          <div className={isList ? "min-w-0 flex-1 text-left" : undefined}>
            {isList && !editing && !pendingDelete ? (
              <LibraryListContent item={item} pinned={pinVisible && pinned} onOpen={onOpenInspect} />
            ) : <p className="text-sm font-medium">{title}</p>}
          </div>
        )}
        {isList && !editing && !pendingDelete ? <LibraryListMetadata collections={collectionNames} tags={tagNames} onBrowseTag={onBrowseTag} /> : null}

        {item.type === "note" && editing ? (
          <div className="mt-2 flex flex-col gap-2">
            <label
              className="text-sm font-medium"
              htmlFor={`edit-note-${item.id}`}
            >
              Note content
            </label>
            <textarea
              className="min-h-24 rounded-md border border-border-edge bg-bg-surface px-3 py-2 disabled:opacity-60"
              id={`edit-note-${item.id}`}
              ref={setFirstEditField}
              value={editDraft}
              disabled={mutationBusy}
              onChange={(event) => onEditDraftChange(event.target.value)}
              onKeyDown={(event) => onEditSaveShortcut(event, onSaveNote)}
            />
            {editError ? (
              <p className="text-sm text-text-danger" role="alert">
                {editError}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-md bg-action-primary px-3 py-1 text-sm font-medium text-text-on-action transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60"
                type="button"
                disabled={mutationBusy}
                onClick={onSaveNote}
              >
                {pendingMutation?.op === "save-note" &&
                pendingMutation.id === item.id
                  ? "Saving…"
                  : "Save note"}
              </button>
              <button
                className="rounded-md border border-border-edge px-3 py-1 text-sm font-medium transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60"
                type="button"
                disabled={mutationBusy}
                onClick={onCancelEdit}
              >
                Cancel edit
              </button>
            </div>
          </div>
        ) : item.type === "link" && editing ? (
          <div className="mt-2 flex flex-col gap-2">
            <label
              className="text-sm font-medium"
              htmlFor={`edit-link-url-${item.id}`}
            >
              URL
            </label>
            <input
              className="rounded-md border border-border-edge bg-bg-surface px-3 py-2 disabled:opacity-60"
              id={`edit-link-url-${item.id}`}
              ref={setFirstEditField}
              value={editDraft}
              disabled={mutationBusy}
              onChange={(event) => onEditDraftChange(event.target.value)}
              onKeyDown={(event) => onEditSaveShortcut(event, onSaveLink)}
            />
            <label
              className="text-sm font-medium"
              htmlFor={`edit-link-title-${item.id}`}
            >
              Title
            </label>
            <input
              className="rounded-md border border-border-edge bg-bg-surface px-3 py-2 disabled:opacity-60"
              id={`edit-link-title-${item.id}`}
              value={editTitleDraft}
              disabled={mutationBusy}
              onChange={(event) => onEditTitleChange(event.target.value)}
              onKeyDown={(event) => onEditSaveShortcut(event, onSaveLink)}
            />
            {editError ? (
              <p className="text-sm text-text-danger" role="alert">
                {editError}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-md bg-action-primary px-3 py-1 text-sm font-medium text-text-on-action transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60"
                type="button"
                disabled={mutationBusy}
                onClick={onSaveLink}
              >
                {pendingMutation?.op === "save-link" &&
                pendingMutation.id === item.id
                  ? "Saving…"
                  : "Save link"}
              </button>
              <button
                className="rounded-md border border-border-edge px-3 py-1 text-sm font-medium transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60"
                type="button"
                disabled={mutationBusy}
                onClick={onCancelEdit}
              >
                Cancel edit
              </button>
            </div>
          </div>
        ) : item.type === "image" && editing ? (
          <div className="mt-2 flex flex-col gap-2">
            <label
              className="text-sm font-medium"
              htmlFor={`edit-image-caption-${item.id}`}
            >
              Caption
            </label>
            <textarea
              className="min-h-20 rounded-md border border-border-edge bg-bg-surface px-3 py-2 disabled:opacity-60"
              id={`edit-image-caption-${item.id}`}
              ref={setFirstEditField}
              value={editDraft}
              disabled={mutationBusy}
              onChange={(event) => onEditDraftChange(event.target.value)}
              onKeyDown={(event) => onEditSaveShortcut(event, onSaveImage)}
            />
            <label
              className="text-sm font-medium"
              htmlFor={`edit-image-source-${item.id}`}
            >
              Source URL
            </label>
            <input
              className="rounded-md border border-border-edge bg-bg-surface px-3 py-2 disabled:opacity-60"
              id={`edit-image-source-${item.id}`}
              value={editTitleDraft}
              disabled={mutationBusy}
              onChange={(event) => onEditTitleChange(event.target.value)}
              onKeyDown={(event) => onEditSaveShortcut(event, onSaveImage)}
            />
            {editError ? (
              <p className="text-sm text-text-danger" role="alert">
                {editError}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-md bg-action-primary px-3 py-1 text-sm font-medium text-text-on-action transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60"
                type="button"
                disabled={mutationBusy}
                onClick={onSaveImage}
              >
                {pendingMutation?.op === "save-image" &&
                pendingMutation.id === item.id
                  ? "Saving…"
                  : "Save image"}
              </button>
              <button
                className="rounded-md border border-border-edge px-3 py-1 text-sm font-medium transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60"
                type="button"
                disabled={mutationBusy}
                onClick={onCancelEdit}
              >
                Cancel edit
              </button>
            </div>
          </div>
        ) : null}
        {!isList && !editing && !pendingDelete ? (
          <LibraryCardMetadata
            collections={collectionNames}
            tags={tagNames}
            onBrowseTag={onBrowseTag}
            onRemoveTag={onRemoveTag}
          />
        ) : null}
        {pendingDelete ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-sm text-text-primary">Delete this item?</p>
            <button
              className="rounded-md bg-action-primary px-3 py-1 text-sm font-medium text-text-on-action transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60"
              type="button"
              ref={confirmDeleteRef}
              disabled={mutationBusy}
              onClick={onConfirmDelete}
            >
              {pendingMutation?.op === "delete" && pendingMutation.id === item.id
                ? "Deleting…"
                : "Confirm delete"}
            </button>
            <button
              className="rounded-md border border-border-edge px-3 py-1 text-sm font-medium transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60"
              type="button"
              disabled={mutationBusy}
              onClick={onCancelDelete}
            >
              Cancel
            </button>
          </div>
        ) : null}
      </motion.div>
      </div>
    </li>
  );
}
