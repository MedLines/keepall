"use client";

import { OrgNameSuggest, type OrgNameSuggestion } from "./org-name-suggest";

export type BulkPanel = null | "delete" | "add-tag" | "remove-tag" | "add-collection";

type Props = {
  count: number;
  panel: BulkPanel;
  busy: boolean;
  error: string | null;
  tagDraft: string;
  removeTagDraft: string;
  collectionDraft: string;
  tagSuggestions: OrgNameSuggestion[];
  removeTagSuggestions: OrgNameSuggestion[];
  collectionSuggestions: OrgNameSuggestion[];
  pendingAddTag: boolean;
  pendingRemoveTag: boolean;
  pendingAddCollection: boolean;
  pendingDelete: boolean;
  onOpenPanel: (panel: Exclude<BulkPanel, null>) => void;
  onClosePanel: () => void;
  onClearSelection: () => void;
  onConfirmDelete: () => void;
  onTagDraftChange: (value: string) => void;
  onRemoveTagDraftChange: (value: string) => void;
  onCollectionDraftChange: (value: string) => void;
  onBulkAddTag: (name: string) => void;
  onBulkRemoveTag: (name: string) => void;
  onBulkAddCollection: (name: string) => void;
};

export function LibraryBulkBar({
  count,
  panel,
  busy,
  error,
  tagDraft,
  removeTagDraft,
  collectionDraft,
  tagSuggestions,
  removeTagSuggestions,
  collectionSuggestions,
  pendingAddTag,
  pendingRemoveTag,
  pendingAddCollection,
  pendingDelete,
  onOpenPanel,
  onClosePanel,
  onClearSelection,
  onConfirmDelete,
  onTagDraftChange,
  onRemoveTagDraftChange,
  onCollectionDraftChange,
  onBulkAddTag,
  onBulkRemoveTag,
  onBulkAddCollection,
}: Props) {
  if (count === 0) {
    return null;
  }

  return (
    <div
      className="mt-3 rounded-lg border border-zinc-300 bg-zinc-50 p-3"
      role="region"
      aria-label="Bulk actions"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-zinc-800">
          {count} selected
        </p>
        <button
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 disabled:opacity-60"
          disabled={busy}
          type="button"
          onClick={() => onOpenPanel("delete")}
        >
          Delete
        </button>
        <button
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 disabled:opacity-60"
          disabled={busy}
          type="button"
          onClick={() => onOpenPanel("add-tag")}
        >
          Add tag
        </button>
        <button
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 disabled:opacity-60"
          disabled={busy}
          type="button"
          onClick={() => onOpenPanel("remove-tag")}
        >
          Remove tag
        </button>
        <button
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 disabled:opacity-60"
          disabled={busy}
          type="button"
          onClick={() => onOpenPanel("add-collection")}
        >
          Add to collection
        </button>
        <button
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 disabled:opacity-60"
          disabled={busy}
          type="button"
          onClick={onClearSelection}
        >
          Clear selection
        </button>
      </div>

      {panel === "delete" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-sm text-zinc-700">
            Delete {count} item{count === 1 ? "" : "s"}? This cannot be undone.
          </p>
          <button
            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-800 disabled:opacity-60"
            disabled={busy}
            type="button"
            onClick={onConfirmDelete}
          >
            {pendingDelete ? "Deleting…" : "Confirm delete"}
          </button>
          <button
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 disabled:opacity-60"
            disabled={busy}
            type="button"
            onClick={onClosePanel}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {panel === "add-tag" ? (
        <div className="mt-3 max-w-md">
          <OrgNameSuggest
            compact
            inputId="bulk-add-tag"
            label="Add tag to selection"
            placeholder="Tag name"
            value={tagDraft}
            suggestions={tagSuggestions}
            disabled={busy}
            pending={pendingAddTag}
            submitLabel="Add"
            error={error}
            onChange={onTagDraftChange}
            onCancel={onClosePanel}
            onSubmit={onBulkAddTag}
          />
        </div>
      ) : null}

      {panel === "remove-tag" ? (
        <div className="mt-3 max-w-md">
          <OrgNameSuggest
            compact
            inputId="bulk-remove-tag"
            label="Remove tag from selection"
            placeholder="Tag name"
            value={removeTagDraft}
            suggestions={removeTagSuggestions}
            disabled={busy}
            pending={pendingRemoveTag}
            submitLabel="Remove"
            error={error}
            onChange={onRemoveTagDraftChange}
            onCancel={onClosePanel}
            onSubmit={onBulkRemoveTag}
          />
        </div>
      ) : null}

      {panel === "add-collection" ? (
        <div className="mt-3 max-w-md">
          <OrgNameSuggest
            compact
            inputId="bulk-add-collection"
            label="Move selection to collection"
            placeholder="Collection"
            value={collectionDraft}
            suggestions={collectionSuggestions}
            disabled={busy}
            pending={pendingAddCollection}
            submitLabel="Move"
            error={error}
            onChange={onCollectionDraftChange}
            onCancel={onClosePanel}
            onSubmit={onBulkAddCollection}
          />
        </div>
      ) : null}

      {panel === null && error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
