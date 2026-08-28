"use client";

import { OrgNameSuggest, type OrgNameSuggestion } from "./org-name-suggest";
import { SHELL_TOP_BTN, SHELL_TOP_BTN_IDLE } from "./shell-styles";

export type BulkPanel = null | "delete" | "add-tag" | "remove-tag" | "add-collection";

export type LibraryBulkBarProps = {
  count: number;
  visibleCount: number;
  allVisibleSelected: boolean;
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
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  onConfirmDelete: () => void;
  onTagDraftChange: (value: string) => void;
  onRemoveTagDraftChange: (value: string) => void;
  onCollectionDraftChange: (value: string) => void;
  onBulkAddTag: (name: string) => void;
  onBulkRemoveTag: (name: string) => void;
  onBulkAddCollection: (name: string) => void;
};

const BULK_BTN = `${SHELL_TOP_BTN} ${SHELL_TOP_BTN_IDLE} h-8 shrink-0 px-2 text-xs`;

type ToolbarProps = Pick<
  LibraryBulkBarProps,
  | "count"
  | "allVisibleSelected"
  | "busy"
  | "onOpenPanel"
  | "onSelectAllVisible"
  | "onClearSelection"
>;

/** Compact bulk buttons for the top bar (selection must be active). */
export function LibraryBulkToolbar({
  count,
  allVisibleSelected,
  busy,
  onOpenPanel,
  onSelectAllVisible,
  onClearSelection,
}: ToolbarProps) {
  if (count === 0) {
    return null;
  }

  return (
    <div
      className="flex min-w-0 items-center gap-1 overflow-x-auto"
      role="region"
      aria-label="Bulk actions"
    >
      <span className="shrink-0 pr-1 text-xs font-medium tabular-nums text-zinc-800">
        {count} selected
      </span>
      {!allVisibleSelected ? (
        <button
          className={BULK_BTN}
          disabled={busy}
          type="button"
          onClick={onSelectAllVisible}
        >
          Select all
        </button>
      ) : null}
      <button
        className={BULK_BTN}
        disabled={busy}
        type="button"
        onClick={onClearSelection}
      >
        Deselect all
      </button>
      <button
        className={BULK_BTN}
        disabled={busy}
        type="button"
        onClick={() => onOpenPanel("delete")}
      >
        Delete
      </button>
      <button
        className={BULK_BTN}
        disabled={busy}
        type="button"
        onClick={() => onOpenPanel("add-tag")}
      >
        Add tag
      </button>
      <button
        className={BULK_BTN}
        disabled={busy}
        type="button"
        onClick={() => onOpenPanel("remove-tag")}
      >
        Remove tag
      </button>
      <button
        className={BULK_BTN}
        disabled={busy}
        type="button"
        onClick={() => onOpenPanel("add-collection")}
      >
        Add to collection
      </button>
    </div>
  );
}

type PanelsProps = Pick<
  LibraryBulkBarProps,
  | "count"
  | "panel"
  | "busy"
  | "error"
  | "tagDraft"
  | "removeTagDraft"
  | "collectionDraft"
  | "tagSuggestions"
  | "removeTagSuggestions"
  | "collectionSuggestions"
  | "pendingAddTag"
  | "pendingRemoveTag"
  | "pendingAddCollection"
  | "pendingDelete"
  | "onClosePanel"
  | "onConfirmDelete"
  | "onTagDraftChange"
  | "onRemoveTagDraftChange"
  | "onCollectionDraftChange"
  | "onBulkAddTag"
  | "onBulkRemoveTag"
  | "onBulkAddCollection"
>;

/** Confirm / form row under the top bar when a bulk panel is open. */
export function LibraryBulkPanels({
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
  onClosePanel,
  onConfirmDelete,
  onTagDraftChange,
  onRemoveTagDraftChange,
  onCollectionDraftChange,
  onBulkAddTag,
  onBulkRemoveTag,
  onBulkAddCollection,
}: PanelsProps) {
  if (panel === null && !error) {
    return null;
  }

  return (
    <div className="border-t border-zinc-100 bg-zinc-50/80 px-3 py-2 sm:px-4">
      {panel === "delete" ? (
        <div className="flex flex-wrap items-center gap-2">
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
        <div className="max-w-md">
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
        <div className="max-w-md">
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
        <div className="max-w-md">
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
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** @deprecated Use LibraryBulkToolbar + LibraryBulkPanels in the top bar. */
export function LibraryBulkBar(props: LibraryBulkBarProps) {
  if (props.visibleCount === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-lg border border-zinc-300 bg-zinc-50 p-3">
      <LibraryBulkToolbar {...props} />
      <div className="mt-2">
        <LibraryBulkPanels {...props} />
      </div>
    </div>
  );
}
