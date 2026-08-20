"use client";

import { type KeyboardEvent, type Ref } from "react";
import { itemListTitle, type Item } from "@/domain/item";

type PendingMutation =
  | { op: "save-note"; id: string }
  | { op: "save-link"; id: string }
  | { op: "delete"; id: string };

export type LibraryItemProps = {
  item: Item;
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
  onStartEdit: () => void;
  onStartDelete: () => void;
};

export function LibraryItem({
  item,
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
  onStartEdit,
  onStartDelete,
}: LibraryItemProps) {
  return (
    <li className="rounded-md border border-zinc-200 bg-white p-4">
      <h3 className="font-medium">{itemListTitle(item)}</h3>
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
      ) : item.type === "note" ? (
        <p className="mt-2 whitespace-pre-wrap text-zinc-800">{item.content}</p>
      ) : (
        <p className="mt-2">
          <a
            className="break-all text-zinc-800 underline"
            href={item.url}
            rel="noreferrer"
            target="_blank"
          >
            {item.url}
          </a>
        </p>
      )}
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
