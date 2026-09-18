"use client";

import { SideDrawer } from "@/components/ui/side-drawer";
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
      className="scroll-fade-x flex h-9 w-full min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap"
      role="region"
      aria-label="Bulk actions"
    >
      <span className="shrink-0 pr-1 text-xs font-medium tabular-nums text-text-primary">
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

function bulkPanelTitle(panel: BulkPanel, count: number): string {
  const itemLabel = `${count} selected item${count === 1 ? "" : "s"}`;
  switch (panel) {
    case "add-tag":
      return `Add tag to ${itemLabel}`;
    case "remove-tag":
      return `Remove tag from ${itemLabel}`;
    case "add-collection":
      return `Move ${itemLabel} to a collection`;
    case "delete":
      return `Delete ${itemLabel}`;
    default:
      return "Bulk action";
  }
}

/** Drawer containing the active bulk action. */
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

  const side =
    typeof document !== "undefined" && document.documentElement.dir === "rtl"
      ? "left"
      : "right";

  return (
    <SideDrawer
      open
      side={side}
      title={bulkPanelTitle(panel, count)}
      description="This change applies to the current selection."
      closeDisabled={busy}
      onOpenChange={(open, eventDetails) => {
        if (open) {
          return;
        }
        if (busy) {
          eventDetails.cancel();
          return;
        }
        onClosePanel();
      }}
    >
      <div className="scroll-fade min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {panel === "delete" ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-primary">
              Delete {count} item{count === 1 ? "" : "s"}? This cannot be
              undone.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className="min-h-10 rounded-control border border-border-danger bg-bg-surface px-3 text-sm font-medium text-text-danger disabled:opacity-60"
                disabled={busy}
                type="button"
                onClick={onConfirmDelete}
              >
                {pendingDelete ? "Deleting…" : "Confirm delete"}
              </button>
              <button
                className="min-h-10 rounded-control border border-border-edge bg-bg-surface px-3 text-sm font-medium text-text-primary disabled:opacity-60"
                disabled={busy}
                type="button"
                onClick={onClosePanel}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {panel === "add-tag" ? (
          <div>
            <OrgNameSuggest
              inputId="bulk-add-tag"
              label="Add tag to selection"
              placeholder="Search or create a tag"
              value={tagDraft}
              suggestions={tagSuggestions}
              disabled={busy}
              pending={pendingAddTag}
              submitLabel="Add"
              error={error}
              suggestWhenEmpty={false}
              onChange={onTagDraftChange}
              onCancel={onClosePanel}
              onSubmit={onBulkAddTag}
            />
          </div>
        ) : null}

        {panel === "remove-tag" ? (
          <div>
            <OrgNameSuggest
              inputId="bulk-remove-tag"
              label="Remove tag from selection"
              placeholder="Search selected tags"
              value={removeTagDraft}
              suggestions={removeTagSuggestions}
              disabled={busy}
              pending={pendingRemoveTag}
              submitLabel="Remove"
              error={error}
              suggestWhenEmpty={false}
              onChange={onRemoveTagDraftChange}
              onCancel={onClosePanel}
              onSubmit={onBulkRemoveTag}
            />
          </div>
        ) : null}

        {panel === "add-collection" ? (
          <div>
            <OrgNameSuggest
              inputId="bulk-add-collection"
              label="Move selection to collection"
              placeholder="Search or create a collection"
              value={collectionDraft}
              suggestions={collectionSuggestions}
              disabled={busy}
              pending={pendingAddCollection}
              submitLabel="Move"
              error={error}
              suggestWhenEmpty={false}
              onChange={onCollectionDraftChange}
              onCancel={onClosePanel}
              onSubmit={onBulkAddCollection}
            />
          </div>
        ) : null}

        {panel === null && error ? (
          <p className="text-sm text-text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </SideDrawer>
  );
}

/** @deprecated Use LibraryBulkToolbar + LibraryBulkPanels in the top bar. */
export function LibraryBulkBar(props: LibraryBulkBarProps) {
  if (props.visibleCount === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-lg border border-border-edge bg-bg-canvas p-3">
      <LibraryBulkToolbar {...props} />
      <div className="mt-2">
        <LibraryBulkPanels {...props} />
      </div>
    </div>
  );
}
