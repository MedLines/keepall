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
import { itemMediaLayoutId } from "@/domain/library-view";
import { LibraryItemMedia } from "./library-item-media";
import { ItemTagChips } from "./item-tag-chips";
import { OrgNameSuggest, type OrgNameSuggestion } from "./org-name-suggest";

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

  useEffect(() => {
    if (editing || pendingDelete) {
      setOrgPanel(null);
    }
  }, [editing, pendingDelete]);

  const typeLabel =
    item.type === "link" ? "Link" : item.type === "image" ? "Image" : "Note";

  return (
    <li
      draggable={dragEnabled}
      className={`group relative flex flex-col rounded-2xl bg-white p-2 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.06),0_2px_4px_0_rgba(0,0,0,0.04)] transition-[box-shadow,opacity] duration-150 ease-out hover:shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_1px_2px_-1px_rgba(0,0,0,0.08),0_2px_4px_0_rgba(0,0,0,0.06)] ${
        selected ? "ring-2 ring-zinc-900" : ""
      } ${isDragging ? "opacity-50" : ""}`}
      onDragStart={onItemDragStart}
      onDragEnd={onItemDragEnd}
    >
      <label
        className={`absolute left-3 top-3 z-20 flex size-8 items-center justify-center rounded-md bg-white/95 shadow-[0_0_0_1px_rgba(0,0,0,0.06)] ${
          checkboxVisible
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
        }`}
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
      <div className="relative mb-2 overflow-hidden rounded-xl bg-zinc-200">
        {inspected ? (
          <div className="aspect-[16/10] w-full" aria-hidden />
        ) : item.type === "link" ? (
          <a
            aria-label={title}
            className="block overflow-hidden"
            draggable={false}
            href={item.url}
            rel="noreferrer"
            target="_blank"
            style={{ borderRadius: 12 }}
          >
            <motion.div
              layoutId={reduceMotion ? undefined : itemMediaLayoutId(item.id)}
              className="overflow-hidden"
              style={{ borderRadius: 12 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            >
              <LibraryItemMedia item={item} />
            </motion.div>
          </a>
        ) : (
          <motion.div
            layoutId={reduceMotion ? undefined : itemMediaLayoutId(item.id)}
            className="cursor-pointer overflow-hidden"
            style={{ borderRadius: 12 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            onClick={onOpenInspect}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenInspect();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Open ${title}`}
          >
            <LibraryItemMedia item={item} />
          </motion.div>
        )}
        {!inspected && !editing && !pendingDelete ? (
          <div
            className={`absolute inset-x-2 top-2 z-10 flex flex-col items-end gap-1 ${
              actionChromeVisible
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

      <div className="px-2 pb-2">
        <h3 className="text-balance font-medium">
          {!editing && item.type === "link" ? (
            <a
              className="break-words text-zinc-900 underline-offset-2 hover:underline"
              href={item.url}
              rel="noreferrer"
              target="_blank"
            >
              {title}
            </a>
          ) : !editing ? (
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
        </h3>
        <p className="mt-1">
          <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
            {typeLabel}
          </span>
        </p>
        {!editing ? (
          item.type === "link" ? (
            <p className="mt-1 line-clamp-2 text-pretty text-sm text-zinc-600">
              {cardSecondaryLine(item)}
            </p>
          ) : (
            <button
              type="button"
              className="mt-1 line-clamp-2 w-full text-left text-pretty text-sm text-zinc-600"
              onClick={onOpenInspect}
            >
              {cardSecondaryLine(item)}
            </button>
          )
        ) : null}
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
      </div>
    </li>
  );
}
