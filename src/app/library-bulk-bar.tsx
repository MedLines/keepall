"use client";

import { OrganizerDrawer, OrganizerTagChip } from "./organizer-drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { OrgNameSuggest, type OrgNameSuggestion } from "./org-name-suggest";
import { SHELL_TOP_BTN, SHELL_TOP_BTN_IDLE } from "./shell-styles";

export type BulkPanel = null | "delete" | "organize";

export type LibraryBulkBarProps = {
  count: number;
  visibleCount: number;
  allVisibleSelected: boolean;
  panel: BulkPanel;
  busy: boolean;
  error: string | null;
  tagDraft: string;
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
  onDeletePermanently?: () => void;
  onTagDraftChange: (value: string) => void;
  onCollectionDraftChange: (value: string) => void;
  onBulkAddTag: (name: string) => void;
  onBulkRemoveTag: (name: string) => void;
  onBulkRemoveAllTags: () => void;
  onBulkAddCollection: (name: string) => void;
};

const BULK_BTN = `${SHELL_TOP_BTN} ${SHELL_TOP_BTN_IDLE} h-10 shrink-0 px-3 text-xs`;

export type LibraryBulkToolbarProps = Pick<
  LibraryBulkBarProps,
  | "count"
  | "allVisibleSelected"
  | "busy"
  | "onSelectAllVisible"
  | "onClearSelection"
  | "onDeletePermanently"
> & {
  onOpenPanel?: LibraryBulkBarProps["onOpenPanel"];
  onDelete?: () => void;
  deleteLabel?: string;
};

/** Compact bulk buttons for the top bar (selection must be active). */
export function LibraryBulkToolbar({
  count,
  allVisibleSelected,
  busy,
  onOpenPanel,
  onSelectAllVisible,
  onClearSelection,
  onDeletePermanently,
  onDelete,
  deleteLabel,
}: LibraryBulkToolbarProps) {
  if (count === 0) {
    return null;
  }

  return (
    <div
      className="flex min-h-10 w-full min-w-0 flex-wrap items-center gap-1.5"
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
      {onOpenPanel && !onDeletePermanently && !onDelete ? <button
        className={BULK_BTN} disabled={busy} type="button"
        onClick={() => onOpenPanel("organize")}
      >Organize</button> : null}
      <button
        className={onDeletePermanently || onDelete ? `${SHELL_TOP_BTN} h-10 shrink-0 px-3 text-xs text-text-danger` : BULK_BTN}
        disabled={busy}
        type="button"
        onClick={onDelete ?? onDeletePermanently ?? (() => onOpenPanel?.("delete"))}
      >
        {deleteLabel ?? (onDeletePermanently ? "Delete permanently" : "Move to Trash")}
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
  | "onCollectionDraftChange"
  | "onBulkAddTag"
  | "onBulkRemoveTag"
  | "onBulkRemoveAllTags"
  | "onBulkAddCollection"
>;

function bulkPanelTitle(panel: BulkPanel, count: number): string {
  const itemLabel = `${count} selected item${count === 1 ? "" : "s"}`;
  switch (panel) {
    case "organize":
      return `Organize ${itemLabel}`;
    case "delete":
      return `Move ${itemLabel} to Trash`;
    default:
      return "Bulk action";
  }
}

/** Shared organization drawer or trash confirmation for the selection. */
export function LibraryBulkPanels({
  count,
  panel,
  busy,
  error,
  tagDraft,
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
  onCollectionDraftChange,
  onBulkAddTag,
  onBulkRemoveTag,
  onBulkRemoveAllTags,
  onBulkAddCollection,
}: PanelsProps) {
  if (panel === "delete") {
    return <ConfirmDialog
      open
      title={bulkPanelTitle(panel, count)}
      description={`Move ${count} item${count === 1 ? "" : "s"} to Trash? You can restore ${count === 1 ? "it" : "them"} later.`}
      confirmLabel="Move to Trash"
      pendingLabel={pendingDelete ? "Moving…" : "Working…"}
      busy={busy}
      error={error}
      onConfirm={onConfirmDelete}
      onOpenChange={(open) => { if (!open) onClosePanel(); }}
    />;
  }

  if (panel === null && !error) {
    return null;
  }

  return (
    <OrganizerDrawer
      open={panel !== null || Boolean(error)}
      title={bulkPanelTitle(panel, count)}
      description="Add tags or move the selected items to a collection. Changes apply immediately."
      disabled={busy}
      error={error}
      onOpenChange={(open) => { if (!open) onClosePanel(); }}
      tags={
        <div className="flex flex-col gap-6">

          {removeTagSuggestions.length > 0 ? (
            <section aria-labelledby="bulk-current-tags">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 id="bulk-current-tags" className="text-sm font-medium text-text-primary">Tags on the selection</h3>
                <button className="text-sm font-medium text-text-danger hover:underline disabled:opacity-60" type="button" disabled={busy} onClick={onBulkRemoveAllTags}>
                  {pendingRemoveTag ? "Removing…" : "Remove all tags"}
                </button>
              </div>
              <ul className="flex flex-wrap gap-2" aria-label="Tags on selected items">
                {removeTagSuggestions.map((tag) => (
                  <OrganizerTagChip key={tag.id} name={tag.name} disabled={busy}
                    removeLabel={`Remove tag ${tag.name} from selection`} onRemove={() => onBulkRemoveTag(tag.name)} />
                ))}
              </ul>
            </section>
          ) : (
            <p className="text-sm text-text-secondary">The selected items have no tags.</p>
          )}
          <OrgNameSuggest
            embedded
            inputId="bulk-add-tag"
            label="Add tag to selection"
            placeholder="Search or create a tag"
            value={tagDraft}
            suggestions={tagSuggestions}
            disabled={busy}
            pending={pendingAddTag}
            submitLabel="Add"
            suggestWhenEmpty={false}
            onChange={onTagDraftChange}
            onSubmit={onBulkAddTag}
          />
        </div>
      }
      collection={
        <div>
          <OrgNameSuggest
            embedded
            inputId="bulk-add-collection"
            label="Move selection to collection"
            placeholder="Search or create a collection"
            value={collectionDraft}
            suggestions={collectionSuggestions}
            disabled={busy}
            pending={pendingAddCollection}
            submitLabel="Move"
            suggestWhenEmpty={false}
            onChange={onCollectionDraftChange}
            onSubmit={onBulkAddCollection}
          />
        </div>
      }
    />
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
