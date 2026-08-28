"use client";

import {
  type DragEvent,
  type KeyboardEvent,
  type Ref,
  useEffect,
  useState,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import { cardSecondaryLine } from "@/domain/card-display";
import { itemListTitle, type Item } from "@/domain/item";
import type { LibraryLayout } from "@/domain/library-view";
import {
  BROWSE_CHROME_FADE_S,
  itemMediaLayoutProps,
  useBrowseChromeVisible,
} from "./item-media-layout";
import { LibraryItemMedia } from "./library-item-media";
import { ItemTagChips } from "./item-tag-chips";
import { OrgNameSuggest, type OrgNameSuggestion } from "./org-name-suggest";

function formatListDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

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
  onRemoveTag: (tagId: string) => void;
  onAddCollection: (name: string) => void;
  onBrowseTag: (tagId: string) => void;
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
  "relative flex h-8 min-w-8 items-center justify-center rounded-md bg-white/95 px-2 text-xs font-medium text-zinc-800 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.06)] backdrop-blur-sm transition-[transform,box-shadow] duration-150 ease-out after:absolute after:left-1/2 after:top-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2 hover:shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_1px_2px_-1px_rgba(0,0,0,0.08)] active:scale-[0.96] disabled:opacity-60";

export function LibraryItem({
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
  onRemoveTag,
  onAddCollection,
  onBrowseTag,
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
  const reduceMotion = useReducedMotion();

  const actionChromeVisible = orgPanel !== null;
  const checkboxVisible = selected || selectionActive;
  const availableTagSuggestions = tagSuggestions.filter(
    (entry) => !item.tagIds.includes(entry.id),
  );
  const availableCollectionSuggestions = collectionSuggestions.filter(
    (entry) => !item.collectionIds.includes(entry.id),
  );

  const title = itemListTitle(item);
  const secondary = cardSecondaryLine(item);
  const isList = layoutMode === "list";

  useEffect(() => {
    if (editing || pendingDelete) {
      setOrgPanel(null);
    }
  }, [editing, pendingDelete]);

  const typeLabel =
    item.type === "link" ? "Link" : item.type === "image" ? "Image" : "Note";

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
          ? "relative size-10 shrink-0"
          : "relative mb-2 w-full"
      }
    >
      {inspected ? (
        <div
          className={isList ? "size-10" : "aspect-[16/10] w-full"}
          aria-hidden
        />
      ) : (
        <motion.div
          {...itemMediaLayoutProps(item.id, layoutMode, reduceMotion)}
          className={
            isList
              ? `size-10 overflow-hidden ${item.type === "link" ? "bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)]" : "bg-zinc-200"}`
              : item.type === "link"
                ? "aspect-[16/10] w-full overflow-hidden bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
                : "aspect-[16/10] w-full cursor-pointer overflow-hidden bg-zinc-200"
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
            className="!aspect-auto h-full w-full object-cover"
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
      {!isList && !inspected && !editing && !pendingDelete ? (
          <div
            className={`absolute inset-x-2 top-2 z-10 flex flex-col items-end gap-1 transition-opacity duration-100 ${
              !chromeVisible
                ? "pointer-events-none opacity-0"
                : actionChromeVisible
                  ? "pointer-events-auto opacity-100"
                  : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
            }`}
          >
            <div className="flex justify-end gap-1">
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
                Edit
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
                Del
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
                Tag
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
                Col
              </button>
            </div>
            {orgPanel === "tag" ? (
              <div className="w-56 rounded-lg bg-white/95 p-2 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.08)] backdrop-blur-sm">
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
              <div className="w-56 rounded-lg bg-white/95 p-2 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.08)] backdrop-blur-sm">
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
        ) : null}
    </div>
  );

  return (
    <li
      draggable={dragEnabled}
      className={isDragging ? "opacity-50" : undefined}
      onDragStart={onItemDragStart}
      onDragEnd={onItemDragEnd}
    >
      <div
        className={
          isList
            ? `group flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-2 ${
                inspected || selected ? "ring-2 ring-zinc-900" : ""
              }`
            : `group relative flex flex-col rounded-2xl bg-white p-2 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.06),0_2px_4px_0_rgba(0,0,0,0.04)] hover:shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_1px_2px_-1px_rgba(0,0,0,0.08),0_2px_4px_0_rgba(0,0,0,0.06)] ${
                selected ? "ring-2 ring-zinc-900" : ""
              }`
        }
      >
      <label
        className={
          isList
            ? `flex size-8 shrink-0 items-center justify-center transition-opacity duration-100 ${
                !chromeVisible
                  ? "opacity-0"
                  : checkboxVisible
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
              }`
            : `absolute left-3 top-3 z-20 flex size-8 items-center justify-center rounded-md bg-white/95 shadow-[0_0_0_1px_rgba(0,0,0,0.06)] transition-opacity duration-100 ${
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
          className="size-4 rounded border-zinc-300"
          disabled={mutationBusy}
          type="checkbox"
          onChange={onToggleSelect}
          onClick={(event) => event.stopPropagation()}
        />
      </label>
      <div
        className={
          isList && pinVisible
            ? `shrink-0 transition-opacity duration-100 ${
                chromeVisible ? "opacity-100" : "opacity-0"
              }`
            : "pointer-events-none hidden"
        }
      >
        {isList && pinVisible ? (
          <button
            type="button"
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800"
            aria-label={pinned ? "Unpin" : "Pin"}
            onClick={(event) => {
              event.stopPropagation();
              onTogglePin();
            }}
          >
            {pinned ? "Unpin" : "Pin"}
          </button>
        ) : null}
      </div>
      {mediaSlot}
      <motion.div
        {...chromeMotion}
        className={
          isList
            ? "flex min-w-0 flex-1 items-center gap-3"
            : "px-2 pb-2"
        }
        style={{ pointerEvents: chromeVisible ? "auto" : "none" }}
      >
        <div
          className={
            isList ? "min-w-0 flex-1 cursor-pointer text-left" : undefined
          }
          onClick={isList ? onOpenInspect : undefined}
          onKeyDown={
            isList
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenInspect();
                  }
                }
              : undefined
          }
          role={isList ? "button" : undefined}
          tabIndex={isList ? 0 : undefined}
          aria-label={isList ? `Open ${title}` : undefined}
        >
          <div
            className={
              isList
                ? "truncate text-sm font-medium text-zinc-900"
                : "text-balance font-medium"
            }
          >
            {!isList && !editing && item.type === "link" ? (
              <a
                className="break-words text-zinc-900 underline-offset-2 hover:underline"
                href={item.url}
                rel="noreferrer"
                target="_blank"
              >
                {title}
              </a>
            ) : !isList && !editing ? (
              <button
                type="button"
                className="break-words text-left text-zinc-900 underline-offset-2 hover:underline"
                onClick={onOpenInspect}
              >
                {title}
              </button>
            ) : (
              title
            )}
          </div>
          {!isList ? (
            <p className="mt-1">
              <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                {typeLabel}
              </span>
            </p>
          ) : null}
          {secondary && !editing ? (
            <div
              className={
                isList
                  ? "truncate text-xs text-zinc-500"
                  : item.type === "link"
                    ? "mt-1 line-clamp-2 text-pretty text-sm text-zinc-600"
                    : "mt-1 line-clamp-2 w-full cursor-pointer text-left text-pretty text-sm text-zinc-600"
              }
              onClick={
                !isList && item.type !== "link" ? onOpenInspect : undefined
              }
              onKeyDown={
                !isList && item.type !== "link"
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenInspect();
                      }
                    }
                  : undefined
              }
              role={!isList && item.type !== "link" ? "button" : undefined}
              tabIndex={!isList && item.type !== "link" ? 0 : undefined}
            >
              {secondary}
            </div>
          ) : null}
        </div>
        {isList ? (
          <span className="hidden shrink-0 items-center gap-3 text-xs text-zinc-500 sm:flex">
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600">
              {typeLabel}
            </span>
            <time dateTime={new Date(item.createdAt).toISOString()}>
              {formatListDate(item.createdAt)}
            </time>
          </span>
        ) : null}
        {!isList ? (
          <>

        {item.type === "note" && editing ? (
          <div className="mt-2 flex flex-col gap-2">
            <label
              className="text-sm font-medium"
              htmlFor={`edit-note-${item.id}`}
            >
              Note content
            </label>
            <textarea
              className="min-h-24 rounded-md border border-zinc-300 bg-white px-3 py-2 disabled:opacity-60"
              id={`edit-note-${item.id}`}
              ref={setFirstEditField}
              value={editDraft}
              disabled={mutationBusy}
              onChange={(event) => onEditDraftChange(event.target.value)}
              onKeyDown={(event) => onEditSaveShortcut(event, onSaveNote)}
            />
            {editError ? (
              <p className="text-sm text-red-700" role="alert">
                {editError}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60"
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
                className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60"
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
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 disabled:opacity-60"
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
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 disabled:opacity-60"
              id={`edit-link-title-${item.id}`}
              value={editTitleDraft}
              disabled={mutationBusy}
              onChange={(event) => onEditTitleChange(event.target.value)}
              onKeyDown={(event) => onEditSaveShortcut(event, onSaveLink)}
            />
            {editError ? (
              <p className="text-sm text-red-700" role="alert">
                {editError}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60"
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
                className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60"
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
              className="min-h-20 rounded-md border border-zinc-300 bg-white px-3 py-2 disabled:opacity-60"
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
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 disabled:opacity-60"
              id={`edit-image-source-${item.id}`}
              value={editTitleDraft}
              disabled={mutationBusy}
              onChange={(event) => onEditTitleChange(event.target.value)}
              onKeyDown={(event) => onEditSaveShortcut(event, onSaveImage)}
            />
            {editError ? (
              <p className="text-sm text-red-700" role="alert">
                {editError}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60"
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
                className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60"
                type="button"
                disabled={mutationBusy}
                onClick={onCancelEdit}
              >
                Cancel edit
              </button>
            </div>
          </div>
        ) : null}
        {!editing && !pendingDelete ? (
          tagNames.length > 0 || collectionNames.length > 0 ? (
            <div className="mt-2 space-y-1.5">
              {tagNames.length > 0 ? (
                <ItemTagChips
                  tags={tagNames}
                  mutationBusy={mutationBusy}
                  onBrowseTag={onBrowseTag}
                  onRemoveTag={onRemoveTag}
                />
              ) : null}
              {collectionNames.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5" aria-label="Collections">
                  {collectionNames.map((name) => (
                    <li
                      key={name}
                      className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null
        ) : null}
        {pendingDelete ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-sm text-zinc-700">Delete this item?</p>
            <button
              className="rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60"
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
              className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60"
              type="button"
              disabled={mutationBusy}
              onClick={onCancelDelete}
            >
              Cancel
            </button>
          </div>
        ) : null}
          </>
        ) : null}
      </motion.div>
      </div>
    </li>
  );
}
