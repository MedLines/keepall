"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  type Ref,
  useEffect,
  useState,
} from "react";
import { cardInitial, cardSecondaryLine } from "@/domain/card-display";
import { itemListTitle, type Item } from "@/domain/item";
import { useAssetObjectUrl } from "./use-asset-object-url";

export type PendingMutation =
  | { op: "save-note"; id: string }
  | { op: "save-link"; id: string }
  | { op: "delete"; id: string }
  | { op: "assign-tag"; id: string }
  | { op: "assign-collection"; id: string };

export type LibraryItemProps = {
  item: Item;
  tagNames: string[];
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
  onCancelEdit: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onAddTag: (name: string) => void;
  onAddCollection: (name: string) => void;
  onStartEdit: () => void;
  onStartDelete: () => void;
};

export function LibraryItem({
  item,
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
  onCancelEdit,
  onConfirmDelete,
  onCancelDelete,
  onAddTag,
  onAddCollection,
  onStartEdit,
  onStartDelete,
}: LibraryItemProps) {
  const [tagDraft, setTagDraft] = useState("");
  const [collectionDraft, setCollectionDraft] = useState("");

  function submitTag(event: FormEvent) {
    event.preventDefault();
    const name = tagDraft.trim();
    if (!name || mutationBusy) {
      return;
    }
    onAddTag(name);
    setTagDraft("");
  }

  function submitCollection(event: FormEvent) {
    event.preventDefault();
    const name = collectionDraft.trim();
    if (!name || mutationBusy) {
      return;
    }
    onAddCollection(name);
    setCollectionDraft("");
  }

  const title = itemListTitle(item);
  const previewAssetId = item.type === "link" ? item.previewAssetId : null;
  const localObjectUrl = useAssetObjectUrl(previewAssetId);
  const [remoteBroken, setRemoteBroken] = useState(false);
  const remotePreviewUrl =
    item.type === "link" ? item.previewImageUrl : "";

  useEffect(() => {
    setRemoteBroken(false);
  }, [item.id, remotePreviewUrl]);

  const remoteUrl =
    item.type === "link" &&
    item.previewStatus === "ready" &&
    remotePreviewUrl &&
    !remoteBroken
      ? remotePreviewUrl
      : null;
  const imageSrc = localObjectUrl ?? remoteUrl;
  const showPreviewImage = Boolean(imageSrc);

  return (
    <li className="flex flex-col rounded-md border border-zinc-200 bg-white p-4">
      <div className="mb-3 overflow-hidden rounded-md bg-zinc-200">
        {showPreviewImage && item.type === "link" ? (
          <a
            aria-label={title}
            className="block"
            href={item.url}
            rel="noreferrer"
            target="_blank"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URLs + remote OG */}
            <img
              alt=""
              className="aspect-[16/10] w-full object-cover"
              onError={() => {
                if (!localObjectUrl) {
                  setRemoteBroken(true);
                }
              }}
              src={imageSrc!}
            />
          </a>
        ) : (
          <div
            aria-hidden="true"
            className="flex aspect-[16/10] items-center justify-center text-4xl font-semibold text-zinc-700"
          >
            {cardInitial(item)}
          </div>
        )}
      </div>
      <h3 className="font-medium">
        {item.type === "link" && !editing ? (
          <a
            className="break-words text-zinc-900 underline-offset-2 hover:underline"
            href={item.url}
            rel="noreferrer"
            target="_blank"
          >
            {title}
          </a>
        ) : (
          title
        )}
      </h3>
      <p className="mt-1">
        <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
          {item.type === "link" ? "Link" : "Note"}
        </span>
      </p>
      {!editing ? (
        <p className="mt-1 line-clamp-2 text-sm text-zinc-600">
          {cardSecondaryLine(item)}
        </p>
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
              className="rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white disabled:opacity-60"
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
              className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium disabled:opacity-60"
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
              className="rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white disabled:opacity-60"
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
              className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium disabled:opacity-60"
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
        <div className="mt-3">
          {tagNames.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label="Tags">
              {tagNames.map((name) => (
                <li
                  key={name}
                  className="rounded-md bg-zinc-100 px-2 py-0.5 text-sm text-zinc-700"
                >
                  {name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No tags yet.</p>
          )}
          <form
            className="mt-2 flex flex-wrap items-end gap-2"
            onSubmit={submitTag}
          >
            <div className="flex min-w-40 flex-1 flex-col gap-1">
              <label
                className="text-sm font-medium"
                htmlFor={`add-tag-${item.id}`}
              >
                Add tag
              </label>
              <input
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 disabled:opacity-60"
                id={`add-tag-${item.id}`}
                value={tagDraft}
                disabled={mutationBusy}
                onChange={(event) => setTagDraft(event.target.value)}
              />
            </div>
            <button
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-60"
              type="submit"
              disabled={mutationBusy}
            >
              {pendingMutation?.op === "assign-tag" &&
              pendingMutation.id === item.id
                ? "Adding…"
                : "Add tag"}
            </button>
          </form>
          {tagError ? (
            <p className="mt-2 text-sm text-red-700" role="alert">
              {tagError}
            </p>
          ) : null}
          <div className="mt-4">
            {collectionNames.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label="Collections">
                {collectionNames.map((name) => (
                  <li
                    key={name}
                    className="rounded-md bg-zinc-100 px-2 py-0.5 text-sm text-zinc-700"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">No collections yet.</p>
            )}
            <form
              className="mt-2 flex flex-wrap items-end gap-2"
              onSubmit={submitCollection}
            >
              <div className="flex min-w-40 flex-1 flex-col gap-1">
                <label
                  className="text-sm font-medium"
                  htmlFor={`add-collection-${item.id}`}
                >
                  Add to collection
                </label>
                <input
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 disabled:opacity-60"
                  id={`add-collection-${item.id}`}
                  value={collectionDraft}
                  disabled={mutationBusy}
                  onChange={(event) => setCollectionDraft(event.target.value)}
                />
              </div>
              <button
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-60"
                type="submit"
                disabled={mutationBusy}
              >
                {pendingMutation?.op === "assign-collection" &&
                pendingMutation.id === item.id
                  ? "Adding…"
                  : "Add to collection"}
              </button>
            </form>
            {collectionError ? (
              <p className="mt-2 text-sm text-red-700" role="alert">
                {collectionError}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {pendingDelete ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-zinc-700">Delete this item?</p>
          <button
            className="rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white disabled:opacity-60"
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
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium disabled:opacity-60"
            type="button"
            disabled={mutationBusy}
            onClick={onCancelDelete}
          >
            Cancel
          </button>
        </div>
      ) : editing ? null : (
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium disabled:opacity-60"
            type="button"
            data-focus-return={`edit:${item.id}`}
            disabled={mutationBusy}
            onClick={onStartEdit}
          >
            Edit
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium disabled:opacity-60"
            type="button"
            data-focus-return={`delete:${item.id}`}
            disabled={mutationBusy}
            onClick={onStartDelete}
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}
