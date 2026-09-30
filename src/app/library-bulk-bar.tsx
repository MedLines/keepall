"use client";

import { Menu } from "@base-ui/react/menu";
import { useLayoutEffect, useRef, useState } from "react";
import { OrganizerDrawer, OrganizerTagChip } from "./organizer-drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { OrgNameSuggest, type OrgNameSuggestion } from "./org-name-suggest";
import { SHELL_TOP_BTN, SHELL_TOP_BTN_IDLE } from "./shell-styles";
import { ChevronDownIcon, SelectionCheckedIcon } from "./shell-icons";

export type BulkPanel = null | "delete" | "organize";

export type LibraryBulkBarProps = {
  count: number;
  hiddenCount?: number;
  panelCount?: number;
  panelHiddenCount?: number;
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
  onClearHidden?: () => void;
  onConfirmDelete: () => void;
  onDeletePermanently?: () => void;
  onRestoreSelected?: () => void;
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
  | "hiddenCount"
  | "allVisibleSelected"
  | "busy"
  | "onSelectAllVisible"
  | "onClearSelection"
  | "onClearHidden"
  | "onDeletePermanently"
  | "onRestoreSelected"
> & {
  onOpenPanel?: LibraryBulkBarProps["onOpenPanel"];
  onDelete?: () => void;
  deleteLabel?: string;
};

/** Compact bulk buttons for the top bar (selection must be active). */
export function LibraryBulkToolbar({
  count,
  hiddenCount = 0,
  allVisibleSelected,
  busy,
  onOpenPanel,
  onSelectAllVisible,
  onClearSelection,
  onClearHidden,
  onDeletePermanently,
  onRestoreSelected,
  onDelete,
  deleteLabel,
}: LibraryBulkToolbarProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreTriggerFocus = useRef(true);
  const focusSearchAfterClose = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(true);
  const [preferredWidth, setPreferredWidth] = useState<number>();

  useLayoutEffect(() => {
    const container = containerRef.current;
    const actions = actionsRef.current;
    if (!container || !actions || typeof ResizeObserver === "undefined") return;
    const slot = container.parentElement;
    const measure = () => {
      const width = actions.scrollWidth;
      const available = slot?.clientWidth ?? container.clientWidth;
      setPreferredWidth(width);
      setCompact(available < width);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(actions);
    if (slot) observer.observe(slot);
    measure();
    return () => observer.disconnect();
  }, [count, hiddenCount, allVisibleSelected, onOpenPanel, onDelete, onDeletePermanently, onRestoreSelected, deleteLabel]);

  const destructiveAction = onDelete ?? onDeletePermanently ?? (() => onOpenPanel?.("delete"));
  const destructiveLabel = deleteLabel ?? (onDeletePermanently ? "Delete permanently" : "Move to Trash");

  function runWithoutTriggerRestore(action: () => void) {
    restoreTriggerFocus.current = false;
    action();
  }

  return (
    <div ref={containerRef} className={`relative flex h-10 min-w-0 max-w-full items-center justify-end gap-1.5 ${count === 0 ? "invisible" : ""}`} style={{ width: compact ? undefined : preferredWidth }} inert={count === 0} aria-hidden={count === 0} role="region" aria-label="Bulk actions">
      {compact ? <Menu.Root
        modal={false}
        disabled={busy || count === 0}
        onOpenChange={(open, details) => {
          if (open) {
            restoreTriggerFocus.current = true;
            focusSearchAfterClose.current = false;
          } else if (["outside-press", "focus-out", "sibling-open"].includes(details.reason)) {
            restoreTriggerFocus.current = false;
          }
        }}
      >
        <Menu.Trigger
          ref={triggerRef}
          type="button"
          className="ui-control inline-flex h-10 min-w-0 shrink-0 items-center gap-1.5 rounded-control px-2.5 text-xs font-medium tabular-nums text-text-primary sm:px-3"
          aria-label={`Selection actions: ${count} selected`}
          disabled={busy || count === 0}
        >
          <span className="inline-flex items-center gap-1 sm:hidden">
            {count}
            <SelectionCheckedIcon className="size-4" />
          </span>
          <span className="hidden sm:inline">{count} selected</span>
          <ChevronDownIcon className="size-4" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="start" sideOffset={4} collisionPadding={8} positionMethod="fixed" className="z-[60] data-[anchor-hidden]:invisible">
            <Menu.Popup
              aria-label="Selection actions"
              className="ui-popover max-h-[var(--available-height)] min-w-48 max-w-[calc(100vw-1rem)] overflow-y-auto outline-none"
              finalFocus={() => focusSearchAfterClose.current
                ? document.getElementById("library-search")
                : restoreTriggerFocus.current ? triggerRef.current : false}
            >
              {!allVisibleSelected ? (
                <Menu.Item className="ui-menu-item flex w-full text-left text-sm text-text-primary data-[highlighted]:bg-bg-active" onClick={onSelectAllVisible}>
                  Select all
                </Menu.Item>
              ) : null}
              <Menu.Item className="ui-menu-item flex w-full text-left text-sm text-text-primary data-[highlighted]:bg-bg-active" onClick={() => runWithoutTriggerRestore(() => {
                focusSearchAfterClose.current = true;
                onClearSelection();
              })}>
                Deselect all
              </Menu.Item>
              {hiddenCount > 0 ? <Menu.Item className="ui-menu-item flex w-full text-left text-sm text-text-primary data-[highlighted]:bg-bg-active" onClick={() => runWithoutTriggerRestore(() => {
                focusSearchAfterClose.current = true;
                onClearHidden?.();
              })}>
                Clear hidden selection
              </Menu.Item> : null}
              {onOpenPanel && !onDeletePermanently && !onDelete ? (
                <Menu.Item className="ui-menu-item flex w-full text-left text-sm text-text-primary data-[highlighted]:bg-bg-active" onClick={() => runWithoutTriggerRestore(() => onOpenPanel("organize"))}>
                  Organize
                </Menu.Item>
              ) : null}
              {onRestoreSelected && count > 0 ? <Menu.Item disabled={busy} className="ui-menu-item flex w-full text-left text-sm text-text-primary data-[highlighted]:bg-bg-active" onClick={() => runWithoutTriggerRestore(onRestoreSelected)}>
                Restore selected
              </Menu.Item> : null}
              <Menu.Item className="ui-menu-item flex w-full text-left text-sm text-text-danger data-[highlighted]:bg-bg-danger" onClick={() => runWithoutTriggerRestore(destructiveAction)}>
                {destructiveLabel}
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root> : null}
      {compact && hiddenCount > 0 ? <span className="shrink-0 text-xs tabular-nums text-text-secondary">{hiddenCount} hidden</span> : null}
      <div ref={actionsRef} inert={compact} aria-hidden={compact} className={`inline-flex w-max items-center gap-1.5 ${compact ? "pointer-events-none invisible absolute right-0 top-0" : ""}`}>
        <span className="mr-1 shrink-0 text-xs tabular-nums text-text-secondary">{count} selected{hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ""}</span>
        {!allVisibleSelected ? (
          <button className={BULK_BTN} disabled={busy} type="button" onClick={onSelectAllVisible}>
            Select all
          </button>
        ) : null}
        <button className={BULK_BTN} disabled={busy} type="button" onClick={() => { document.getElementById("library-search")?.focus(); onClearSelection(); }}>
          Deselect all
        </button>
        {hiddenCount > 0 ? <button className={BULK_BTN} disabled={busy} type="button" onClick={() => { document.getElementById("library-search")?.focus(); onClearHidden?.(); }}>
          Clear hidden
        </button> : null}
        {onOpenPanel && !onDeletePermanently && !onDelete ? (
          <button className={BULK_BTN} disabled={busy} type="button" onClick={() => onOpenPanel("organize")}>
            Organize
          </button>
        ) : null}
        {onRestoreSelected && count > 0 ? <button className={BULK_BTN} disabled={busy} type="button" onClick={onRestoreSelected}>
          Restore selected
        </button> : null}
        <button
          className={`${onDeletePermanently || onDelete ? `${SHELL_TOP_BTN} text-text-danger` : BULK_BTN} h-10 shrink-0 px-3 text-xs`}
          disabled={busy}
          type="button"
          onClick={destructiveAction}
        >
          {destructiveLabel}
        </button>
      </div>
    </div>
  );
}

type PanelsProps = Pick<
  LibraryBulkBarProps,
  | "count"
  | "hiddenCount"
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
  hiddenCount = 0,
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
      description={`Move ${count} item${count === 1 ? "" : "s"} to Trash?${hiddenCount > 0 ? ` ${hiddenCount} selected item${hiddenCount === 1 ? " is" : "s are"} hidden by search or filters.` : ""} You can restore ${count === 1 ? "it" : "them"} later.`}
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
      description={`Move the selected items to a collection or add tags. Changes apply immediately${hiddenCount > 0 ? ` to all ${count} selected items, including ${hiddenCount} hidden by search or filters` : ""}.`}
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
