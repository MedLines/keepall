"use client";

import { useEffect, useId, useRef } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import { cardSecondaryLine } from "@/domain/card-display";
import { clampImageSlideIndex } from "@/domain/image";
import { itemListTitle, type Item } from "@/domain/item";
import { linkCanManualPreviewFetch } from "@/domain/preview-enrich";
import { itemMediaLayoutId } from "@/domain/library-view";
import { LibraryItemMedia } from "./library-item-media";
import { ItemTagChips } from "./item-tag-chips";
import type { PendingMutation } from "./library-item";
import { OrgNameSuggest, type OrgNameSuggestion } from "./org-name-suggest";
import { requestManualPreviewEnrich } from "./preview-enrich-coordinator";
import {
  type KeyboardEvent,
  type Ref,
  useState,
} from "react";

type Props = {
  item: Item | null;
  slide: number;
  galleryError: string | null;
  tagNames: { id: string; name: string }[];
  collectionNames: string[];
  tagError: string | null;
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
  onClose: () => void;
  onSlideChange: (slide: number) => void;
  onAddImages: (files: File[]) => void;
  onReplaceSlide: (file: File) => void;
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
  tagSuggestions: OrgNameSuggestion[];
  collectionSuggestions: OrgNameSuggestion[];
  pinVisible: boolean;
  pinned: boolean;
  pinError: string | null;
  onTogglePin: () => void;
};

const BTN =
  "rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60";

export function LibraryInspect({
  item,
  slide,
  galleryError,
  tagNames,
  collectionNames,
  tagError,
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
  onClose,
  onSlideChange,
  onAddImages,
  onReplaceSlide,
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
  tagSuggestions,
  collectionSuggestions,
  pinVisible,
  pinned,
  pinError,
  onTogglePin,
}: Props) {
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const addImageInputRef = useRef<HTMLInputElement>(null);
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [collectionDraft, setCollectionDraft] = useState("");

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onSlideChangeRef = useRef(onSlideChange);
  onSlideChangeRef.current = onSlideChange;

  const imageSlide =
    item?.type === "image"
      ? clampImageSlideIndex(item.assetIds, slide)
      : 0;
  const imageAssetId =
    item?.type === "image" ? (item.assetIds[imageSlide] ?? null) : null;
  const imageSlideCount = item?.type === "image" ? item.assetIds.length : 0;

  useEffect(() => {
    if (!item) {
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const currentItem = item;

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (
        currentItem.type === "image" &&
        imageSlideCount > 1 &&
        !editing &&
        !pendingDelete
      ) {
        if (event.key === "ArrowLeft" && imageSlide > 0) {
          event.preventDefault();
          onSlideChangeRef.current(imageSlide - 1);
        }
        if (event.key === "ArrowRight" && imageSlide < imageSlideCount - 1) {
          event.preventDefault();
          onSlideChangeRef.current(imageSlide + 1);
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [item, imageSlide, imageSlideCount, editing, pendingDelete]);

  useEffect(() => {
    setTagDraft("");
    setCollectionDraft("");
  }, [item?.id]);

  const open = item !== null;
  const availableTagSuggestions =
    item === null
      ? []
      : tagSuggestions.filter((entry) => !item.tagIds.includes(entry.id));
  const availableCollectionSuggestions =
    item === null
      ? []
      : collectionSuggestions.filter(
          (entry) => !item.collectionIds.includes(entry.id),
        );
  const title = item ? itemListTitle(item) : "";
  const typeLabel = item
    ? item.type === "link"
      ? "Link"
      : item.type === "image"
        ? "Image"
        : "Note"
    : "";

  return (
    <AnimatePresence initial={false} mode="wait">
      {open && item ? (
        <motion.div
          key="inspect-root"
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <motion.button
            type="button"
            aria-label="Close detail"
            className="absolute inset-0 bg-zinc-950/40"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{
              duration: 0.2,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            className="relative z-10 flex max-h-[min(96vh,64rem)] w-full max-w-4xl flex-col overflow-hidden bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_16px_40px_rgba(0,0,0,0.18)] outline-none sm:rounded-2xl"
            style={{ borderRadius: 16 }}
            initial={
              reduceMotion ? false : { opacity: 0, scale: 0.95 }
            }
            animate={{ opacity: 1, scale: 1 }}
            exit={{
              opacity: 0,
              scale: 0.95,
              transition: { duration: 0.12 },
            }}
            transition={{
              duration: 0.2,
              ease: [0.23, 1, 0.32, 1],
            }}
          >
            <div className="relative shrink-0 bg-zinc-950">
              <motion.div
                layoutId={
                  reduceMotion ? undefined : itemMediaLayoutId(item.id)
                }
                style={{ borderRadius: 0 }}
                className="overflow-hidden"
                transition={{ type: "spring", duration: 0.3, bounce: 0 }}
              >
                <LibraryItemMedia
                  item={item}
                  variant="inspect"
                  assetId={item.type === "image" ? imageAssetId : undefined}
                />
              </motion.div>
              {item.type === "image" && imageSlideCount > 1 ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    className={`${BTN} pointer-events-auto bg-white/95 backdrop-blur-sm`}
                    disabled={mutationBusy || imageSlide === 0}
                    aria-label="Previous image"
                    onClick={() => onSlideChange(imageSlide - 1)}
                  >
                    Previous
                  </button>
                  <span className="rounded-md bg-zinc-950/70 px-2 py-1 text-xs font-medium text-white">
                    {imageSlide + 1} / {imageSlideCount}
                  </span>
                  <button
                    type="button"
                    className={`${BTN} pointer-events-auto bg-white/95 backdrop-blur-sm`}
                    disabled={
                      mutationBusy || imageSlide >= imageSlideCount - 1
                    }
                    aria-label="Next image"
                    onClick={() => onSlideChange(imageSlide + 1)}
                  >
                    Next
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                className={`${BTN} absolute right-3 top-3 bg-white/95 backdrop-blur-sm`}
                onClick={onClose}
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <h2 id={titleId} className="text-balance text-xl font-semibold">
                {item.type === "link" ? (
                  <a
                    className="text-zinc-900 underline-offset-2 hover:underline"
                    href={item.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {title}
                  </a>
                ) : item.type === "image" && item.sourceUrl ? (
                  <a
                    className="text-zinc-900 underline-offset-2 hover:underline"
                    href={item.sourceUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {title}
                  </a>
                ) : (
                  title
                )}
              </h2>
              <p className="mt-2">
                <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                  {typeLabel}
                </span>
              </p>
              {!editing ? (
                <p className="mt-2 text-pretty text-sm text-zinc-600">
                  {cardSecondaryLine(item)}
                </p>
              ) : null}

              {item.type === "note" && editing ? (
                <EditNote
                  itemId={item.id}
                  editDraft={editDraft}
                  editError={editError}
                  mutationBusy={mutationBusy}
                  pendingMutation={pendingMutation}
                  setFirstEditField={setFirstEditField}
                  onEditDraftChange={onEditDraftChange}
                  onEditSaveShortcut={onEditSaveShortcut}
                  onSaveNote={onSaveNote}
                  onCancelEdit={onCancelEdit}
                />
              ) : null}
              {item.type === "link" && editing ? (
                <EditLink
                  itemId={item.id}
                  editDraft={editDraft}
                  editTitleDraft={editTitleDraft}
                  editError={editError}
                  mutationBusy={mutationBusy}
                  pendingMutation={pendingMutation}
                  setFirstEditField={setFirstEditField}
                  onEditDraftChange={onEditDraftChange}
                  onEditTitleChange={onEditTitleChange}
                  onEditSaveShortcut={onEditSaveShortcut}
                  onSaveLink={onSaveLink}
                  onCancelEdit={onCancelEdit}
                />
              ) : null}
              {item.type === "image" && editing ? (
                <EditImage
                  itemId={item.id}
                  editDraft={editDraft}
                  editTitleDraft={editTitleDraft}
                  editError={editError}
                  mutationBusy={mutationBusy}
                  pendingMutation={pendingMutation}
                  setFirstEditField={setFirstEditField}
                  onEditDraftChange={onEditDraftChange}
                  onEditTitleChange={onEditTitleChange}
                  onEditSaveShortcut={onEditSaveShortcut}
                  onSaveImage={onSaveImage}
                  onCancelEdit={onCancelEdit}
                />
              ) : null}

              {!editing && !pendingDelete ? (
                <>
                  {tagNames.length > 0 ? (
                    <ItemTagChips
                      className="mt-3 flex flex-wrap gap-1.5"
                      tags={tagNames}
                      mutationBusy={mutationBusy}
                      onBrowseTag={onBrowseTag}
                      onRemoveTag={onRemoveTag}
                    />
                  ) : null}
                  {collectionNames.length > 0 ? (
                    <ul
                      className="mt-2 flex flex-wrap gap-1.5"
                      aria-label="Collections"
                    >
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

                  {item.type === "link" && linkCanManualPreviewFetch(item) ? (
                    <div className="mt-3">
                      <button
                        type="button"
                        className={BTN}
                        disabled={mutationBusy || fetchingPreview}
                        onClick={() => {
                          setFetchingPreview(true);
                          void requestManualPreviewEnrich(item.id, item.url).finally(
                            () => setFetchingPreview(false),
                          );
                        }}
                      >
                        {fetchingPreview ? "Fetching…" : "Fetch preview"}
                      </button>
                    </div>
                  ) : null}

                  {pinVisible ? (
                    <div className="mt-3">
                      <button
                        className={BTN}
                        type="button"
                        disabled={mutationBusy}
                        onClick={onTogglePin}
                      >
                        {pendingMutation?.op === "pin-item" &&
                        pendingMutation.itemId === item.id
                          ? "Pinning…"
                          : pendingMutation?.op === "unpin-item" &&
                              pendingMutation.itemId === item.id
                            ? "Unpinning…"
                            : pinned
                              ? "Unpin from collection"
                              : "Pin to top of collection"}
                      </button>
                      {pinError ? (
                        <p className="mt-2 text-sm text-red-700" role="alert">
                          {pinError}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4 max-w-md">
                    <OrgNameSuggest
                      inputId={`inspect-add-tag-${item.id}`}
                      label="Add tag"
                      value={tagDraft}
                      suggestions={availableTagSuggestions}
                      disabled={mutationBusy}
                      pending={
                        pendingMutation?.op === "assign-tag" &&
                        pendingMutation.id === item.id
                      }
                      submitLabel={
                        pendingMutation?.op === "assign-tag" &&
                        pendingMutation.id === item.id
                          ? "Adding…"
                          : "Add tag"
                      }
                      error={tagError}
                      onChange={setTagDraft}
                      onSubmit={(name) => {
                        onAddTag(name);
                        setTagDraft("");
                      }}
                    />
                  </div>

                  <div className="mt-3 max-w-md">
                    <OrgNameSuggest
                      inputId={`inspect-add-collection-${item.id}`}
                      label="Add to collection"
                      value={collectionDraft}
                      suggestions={availableCollectionSuggestions}
                      disabled={mutationBusy}
                      pending={
                        pendingMutation?.op === "assign-collection" &&
                        pendingMutation.id === item.id
                      }
                      submitLabel={
                        pendingMutation?.op === "assign-collection" &&
                        pendingMutation.id === item.id
                          ? "Adding…"
                          : "Add to collection"
                      }
                      error={collectionError}
                      onChange={setCollectionDraft}
                      onSubmit={(name) => {
                        onAddCollection(name);
                        setCollectionDraft("");
                      }}
                    />
                  </div>

                  {item.type === "image" && !editing ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <input
                        ref={addImageInputRef}
                        accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
                        className="sr-only"
                        type="file"
                        multiple
                        onChange={(event) => {
                          const list = event.target.files;
                          if (!list || list.length === 0) {
                            return;
                          }
                          onAddImages(Array.from(list));
                          event.target.value = "";
                        }}
                      />
                      <input
                        ref={replaceImageInputRef}
                        accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
                        className="sr-only"
                        type="file"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            onReplaceSlide(file);
                          }
                          event.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        className={BTN}
                        disabled={mutationBusy}
                        onClick={() => addImageInputRef.current?.click()}
                      >
                        {pendingMutation?.op === "append-image" &&
                        pendingMutation.id === item.id
                          ? "Adding…"
                          : "Add images"}
                      </button>
                      <button
                        type="button"
                        className={BTN}
                        disabled={mutationBusy}
                        onClick={() => replaceImageInputRef.current?.click()}
                      >
                        {pendingMutation?.op === "replace-image-slide" &&
                        pendingMutation.id === item.id
                          ? "Replacing…"
                          : "Replace this image"}
                      </button>
                    </div>
                  ) : null}
                  {galleryError ? (
                    <p className="mt-2 text-sm text-red-700" role="alert">
                      {galleryError}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={BTN}
                      disabled={mutationBusy}
                      onClick={onStartEdit}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={BTN}
                      disabled={mutationBusy}
                      onClick={onStartDelete}
                    >
                      Delete
                    </button>
                  </div>
                </>
              ) : null}

              {pendingDelete ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <p className="text-sm text-zinc-700">Delete this item?</p>
                  <button
                    className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                    type="button"
                    ref={confirmDeleteRef}
                    disabled={mutationBusy}
                    onClick={onConfirmDelete}
                  >
                    {pendingMutation?.op === "delete" &&
                    pendingMutation.id === item.id
                      ? "Deleting…"
                      : "Confirm delete"}
                  </button>
                  <button
                    className={BTN}
                    type="button"
                    disabled={mutationBusy}
                    onClick={onCancelDelete}
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function EditNote({
  itemId,
  editDraft,
  editError,
  mutationBusy,
  pendingMutation,
  setFirstEditField,
  onEditDraftChange,
  onEditSaveShortcut,
  onSaveNote,
  onCancelEdit,
}: {
  itemId: string;
  editDraft: string;
  editError: string | null;
  mutationBusy: boolean;
  pendingMutation: PendingMutation | null;
  setFirstEditField: (
    node: HTMLTextAreaElement | HTMLInputElement | null,
  ) => void;
  onEditDraftChange: (value: string) => void;
  onEditSaveShortcut: (
    event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
    save: () => void,
  ) => void;
  onSaveNote: () => void;
  onCancelEdit: () => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      <label className="text-sm font-medium" htmlFor={`inspect-edit-note-${itemId}`}>
        Note content
      </label>
      <textarea
        className="min-h-32 rounded-md border border-zinc-300 bg-white px-3 py-2 disabled:opacity-60"
        id={`inspect-edit-note-${itemId}`}
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
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          type="button"
          disabled={mutationBusy}
          onClick={onSaveNote}
        >
          {pendingMutation?.op === "save-note" && pendingMutation.id === itemId
            ? "Saving…"
            : "Save note"}
        </button>
        <button
          className={BTN}
          type="button"
          disabled={mutationBusy}
          onClick={onCancelEdit}
        >
          Cancel edit
        </button>
      </div>
    </div>
  );
}

function EditLink({
  itemId,
  editDraft,
  editTitleDraft,
  editError,
  mutationBusy,
  pendingMutation,
  setFirstEditField,
  onEditDraftChange,
  onEditTitleChange,
  onEditSaveShortcut,
  onSaveLink,
  onCancelEdit,
}: {
  itemId: string;
  editDraft: string;
  editTitleDraft: string;
  editError: string | null;
  mutationBusy: boolean;
  pendingMutation: PendingMutation | null;
  setFirstEditField: (
    node: HTMLTextAreaElement | HTMLInputElement | null,
  ) => void;
  onEditDraftChange: (value: string) => void;
  onEditTitleChange: (value: string) => void;
  onEditSaveShortcut: (
    event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
    save: () => void,
  ) => void;
  onSaveLink: () => void;
  onCancelEdit: () => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      <label
        className="text-sm font-medium"
        htmlFor={`inspect-edit-link-url-${itemId}`}
      >
        URL
      </label>
      <input
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 disabled:opacity-60"
        id={`inspect-edit-link-url-${itemId}`}
        ref={setFirstEditField}
        value={editDraft}
        disabled={mutationBusy}
        onChange={(event) => onEditDraftChange(event.target.value)}
        onKeyDown={(event) => onEditSaveShortcut(event, onSaveLink)}
      />
      <label
        className="text-sm font-medium"
        htmlFor={`inspect-edit-link-title-${itemId}`}
      >
        Title
      </label>
      <input
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 disabled:opacity-60"
        id={`inspect-edit-link-title-${itemId}`}
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
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          type="button"
          disabled={mutationBusy}
          onClick={onSaveLink}
        >
          {pendingMutation?.op === "save-link" && pendingMutation.id === itemId
            ? "Saving…"
            : "Save link"}
        </button>
        <button
          className={BTN}
          type="button"
          disabled={mutationBusy}
          onClick={onCancelEdit}
        >
          Cancel edit
        </button>
      </div>
    </div>
  );
}

function EditImage({
  itemId,
  editDraft,
  editTitleDraft,
  editError,
  mutationBusy,
  pendingMutation,
  setFirstEditField,
  onEditDraftChange,
  onEditTitleChange,
  onEditSaveShortcut,
  onSaveImage,
  onCancelEdit,
}: {
  itemId: string;
  editDraft: string;
  editTitleDraft: string;
  editError: string | null;
  mutationBusy: boolean;
  pendingMutation: PendingMutation | null;
  setFirstEditField: (
    node: HTMLTextAreaElement | HTMLInputElement | null,
  ) => void;
  onEditDraftChange: (value: string) => void;
  onEditTitleChange: (value: string) => void;
  onEditSaveShortcut: (
    event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
    save: () => void,
  ) => void;
  onSaveImage: () => void;
  onCancelEdit: () => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      <label
        className="text-sm font-medium"
        htmlFor={`inspect-edit-image-caption-${itemId}`}
      >
        Caption
      </label>
      <textarea
        className="min-h-20 rounded-md border border-zinc-300 bg-white px-3 py-2 disabled:opacity-60"
        id={`inspect-edit-image-caption-${itemId}`}
        ref={setFirstEditField}
        value={editDraft}
        disabled={mutationBusy}
        onChange={(event) => onEditDraftChange(event.target.value)}
        onKeyDown={(event) => onEditSaveShortcut(event, onSaveImage)}
      />
      <label
        className="text-sm font-medium"
        htmlFor={`inspect-edit-image-source-${itemId}`}
      >
        Source URL
      </label>
      <input
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 disabled:opacity-60"
        id={`inspect-edit-image-source-${itemId}`}
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
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          type="button"
          disabled={mutationBusy}
          onClick={onSaveImage}
        >
          {pendingMutation?.op === "save-image" && pendingMutation.id === itemId
            ? "Saving…"
            : "Save image"}
        </button>
        <button
          className={BTN}
          type="button"
          disabled={mutationBusy}
          onClick={onCancelEdit}
        >
          Cancel edit
        </button>
      </div>
    </div>
  );
}
