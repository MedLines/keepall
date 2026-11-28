"use client";


import { focusIsUnclaimed } from "./focus-handoff";
import { Menu } from "@base-ui/react/menu";
import { useLayoutEffect, useRef, useState } from "react";
import { OrganizerDrawer } from "./organizer-drawer";
import { CaptureOrgPanel } from "./capture-org-panel";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { OrgNameSuggestion } from "./org-name-suggest";
import { SHELL_DESTRUCTIVE_BTN, SHELL_TOP_BTN, SHELL_TOP_BTN_IDLE } from "./shell-styles";
import { ArrowRightIcon, ChevronDownIcon, DeleteIcon, DownloadIcon, LayersIcon, SelectionCheckedIcon } from "./shell-icons";
import { buttonClassName } from "@/components/ui/button";
import { menuItemClassName } from "@/components/ui/menu-item";
import { useTranslations, type Translations } from "@/i18n/use-translations";

export type BulkPanel = null | "delete" | "organize";

export type LibraryBulkBarProps = {
  count: number;
  /** Export the selected items as a Context Pack; omitted in Trash. */
  onExport?: () => void;
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
  collectionName?: string | null;
  collectionMixed?: boolean;
  partialTagNames?: string[];
  pendingAddTag: boolean;
  pendingRemoveTag: boolean;
  pendingAddCollection: boolean;
  pendingClearCollection: boolean;
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
  onBulkClearCollection: () => void;
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
  /** Export the selected items as a Context Pack; omitted where export does not apply (Trash). */
  onExport?: () => void;
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
  onExport,
}: LibraryBulkToolbarProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuPopupRef = useRef<HTMLDivElement>(null);
  const restoreTriggerFocus = useRef(true);
  const focusSearchAfterClose = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(true);
  const [preferredWidth, setPreferredWidth] = useState<number>();
  const t = useTranslations("LibraryBulkBar");

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
  }, [count, hiddenCount, allVisibleSelected, onOpenPanel, onDelete, onDeletePermanently, onRestoreSelected, deleteLabel, onExport]);

  const destructiveAction = onDelete ?? onDeletePermanently ?? (() => onOpenPanel?.("delete"));
  const destructiveLabel = deleteLabel ?? (onDeletePermanently ? t("deletePermanently") : t("moveToTrash"));

  function runWithoutTriggerRestore(action: () => void) {
    restoreTriggerFocus.current = false;
    action();
  }

  return (
    <div ref={containerRef} className={`relative flex h-10 min-w-0 max-w-full items-center justify-end gap-1.5 ${count === 0 ? "invisible" : ""}`} style={{ width: compact ? undefined : preferredWidth }} inert={count === 0} aria-hidden={count === 0} role="region" aria-label={t("region")}>
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
          className={buttonClassName({ size: "none", className: "h-10 min-w-0 shrink-0 gap-1.5 px-2.5 text-xs font-medium tabular-nums text-text-primary sm:px-3 justify-start" })}
          aria-label={t("selectionActionsCount", { count })}
          disabled={busy || count === 0}
        >
          <span className="inline-flex items-center gap-1 sm:hidden">
            {count}
            <SelectionCheckedIcon className="size-4" />
          </span>
          <span className="hidden sm:inline">{t("selected", { count })}</span>
          <ChevronDownIcon className="size-4" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="start" sideOffset={4} collisionPadding={8} positionMethod="fixed" className="z-[60] data-[anchor-hidden]:invisible">
            <Menu.Popup
              ref={menuPopupRef}
              aria-label={t("selectionActions")}
              className="ui-menu-popup ui-popover flex flex-col overflow-hidden max-h-[min(24rem,var(--available-height))] min-w-48 max-w-[calc(100vw-1rem)] outline-none"
              finalFocus={() => !focusIsUnclaimed(menuPopupRef.current) ? false
                : focusSearchAfterClose.current ? document.getElementById("library-search")
                : restoreTriggerFocus.current ? triggerRef.current : false}
            >
              <div className="ui-scrollbar flex min-h-0 flex-col overflow-y-auto overscroll-contain">
              {!allVisibleSelected ? (
                <Menu.Item className={menuItemClassName({ layout: "none", className: "text-left" })} onClick={onSelectAllVisible}>
                  {t("selectAll")}
                </Menu.Item>
              ) : null}
              <Menu.Item className={menuItemClassName({ layout: "none", className: "text-left" })} onClick={() => runWithoutTriggerRestore(() => {
                focusSearchAfterClose.current = true;
                onClearSelection();
              })}>
                {t("deselectAll")}
              </Menu.Item>
              {hiddenCount > 0 ? <Menu.Item className={menuItemClassName({ layout: "none", className: "text-left" })} onClick={() => runWithoutTriggerRestore(() => {
                focusSearchAfterClose.current = true;
                onClearHidden?.();
              })}>
                {t("clearHiddenSelection")}
              </Menu.Item> : null}
              {onOpenPanel && !onDeletePermanently && !onDelete ? (
                <Menu.Item className={menuItemClassName({ layout: "none", className: "items-center gap-2 text-left" })} onClick={() => runWithoutTriggerRestore(() => onOpenPanel("organize"))}>
                  <LayersIcon className="size-4" />{t("organize")}
                </Menu.Item>
              ) : null}
              {onExport ? (
                <Menu.Item className={menuItemClassName({ layout: "none", className: "items-center gap-2 text-left" })} onClick={() => runWithoutTriggerRestore(onExport)}>
                  <DownloadIcon className="size-4" />{t("exportSelected")}
                </Menu.Item>
              ) : null}
              {onRestoreSelected && count > 0 ? <Menu.Item disabled={busy} className={menuItemClassName({ layout: "none", className: "items-center gap-2 text-left" })} onClick={() => runWithoutTriggerRestore(onRestoreSelected)}>
                <ArrowRightIcon className="size-4" />{t("restoreSelected")}
              </Menu.Item> : null}
              <Menu.Item className={menuItemClassName({ tone: "danger", layout: "none", className: "items-center gap-2 text-left" })} onClick={() => runWithoutTriggerRestore(destructiveAction)}>
                <DeleteIcon className="size-4" />{destructiveLabel}
              </Menu.Item>
              </div>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root> : null}
      {compact && hiddenCount > 0 ? <span className="shrink-0 text-xs tabular-nums text-text-secondary">{t("hidden", { count: hiddenCount })}</span> : null}
      <div ref={actionsRef} inert={compact} aria-hidden={compact} className={`inline-flex w-max items-center gap-1.5 ${compact ? "pointer-events-none invisible absolute right-0 top-0" : ""}`}>
        <span className="mr-1 shrink-0 text-xs tabular-nums text-text-secondary">{hiddenCount > 0 ? t("selectedHidden", { count, hidden: hiddenCount }) : t("selected", { count })}</span>
        {!allVisibleSelected ? (
          <button className={BULK_BTN} disabled={busy} type="button" onClick={onSelectAllVisible}>
            {t("selectAll")}
          </button>
        ) : null}
        <button className={BULK_BTN} disabled={busy} type="button" onClick={() => { document.getElementById("library-search")?.focus(); onClearSelection(); }}>
          {t("deselectAll")}
        </button>
        {hiddenCount > 0 ? <button className={BULK_BTN} disabled={busy} type="button" onClick={() => { document.getElementById("library-search")?.focus(); onClearHidden?.(); }}>
          {t("clearHidden")}
        </button> : null}
        {onOpenPanel && !onDeletePermanently && !onDelete ? (
          <button className={BULK_BTN} disabled={busy} type="button" onClick={() => onOpenPanel("organize")}>
            <LayersIcon className="size-4" />{t("organize")}
          </button>
        ) : null}
        {onExport ? <button className={BULK_BTN} disabled={busy} type="button" onClick={onExport}>
          <DownloadIcon className="size-4" />{t("export")}
        </button> : null}
        {onRestoreSelected && count > 0 ? <button className={BULK_BTN} disabled={busy} type="button" onClick={onRestoreSelected}>
          <ArrowRightIcon className="size-4" />{t("restoreSelected")}
        </button> : null}
        <button
          className={`${SHELL_TOP_BTN} h-10 shrink-0 px-3 text-xs ${SHELL_DESTRUCTIVE_BTN}`}
          disabled={busy}
          type="button"
          onClick={destructiveAction}
        >
          <DeleteIcon className="size-4" />{destructiveLabel}
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
  | "collectionName"
  | "collectionMixed"
  | "partialTagNames"
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
  | "onBulkClearCollection"
  | "pendingClearCollection"
>;

function bulkPanelTitle(t: Translations<"LibraryBulkBar">, panel: BulkPanel, count: number): string {
  switch (panel) {
    case "organize":
      return t("organizeTitle", { count });
    case "delete":
      return t("deleteTitle", { count });
    default:
      return t("defaultTitle");
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
  collectionName = null,
  collectionMixed = false,
  partialTagNames = [],
  pendingAddTag,
  pendingRemoveTag,
  pendingAddCollection,
  pendingClearCollection,
  pendingDelete,
  onClosePanel,
  onConfirmDelete,
  onTagDraftChange,
  onCollectionDraftChange,
  onBulkAddTag,
  onBulkRemoveTag,
  onBulkRemoveAllTags,
  onBulkAddCollection,
  onBulkClearCollection,
}: PanelsProps) {
  const t = useTranslations("LibraryBulkBar");
  if (panel === "delete") {
    return <ConfirmDialog
      open
      title={bulkPanelTitle(t, panel, count)}
      description={[t("deleteQuestion", { count }), hiddenCount > 0 ? t("deleteHidden", { count: hiddenCount }) : null, t("deleteRestore", { count })].filter(Boolean).join(" ")}
      confirmLabel={t("moveToTrash")}
      pendingLabel={pendingDelete ? t("moving") : t("working")}
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
      title={bulkPanelTitle(t, panel, count)}
      description={hiddenCount > 0 ? t("organizeDescriptionHidden", { count, hidden: hiddenCount }) : t("organizeDescription")}
      disabled={busy}
      error={error}
      onOpenChange={(open) => { if (!open) onClosePanel(); }}
    >
      <CaptureOrgPanel
        collectionName={collectionName}
        collectionInput={collectionDraft}
        collectionInputLabel={t("collectionInput")}
        collectionSuggestions={collectionSuggestions}
        tagNames={removeTagSuggestions.map(tag => tag.name)}
        tagInput={tagDraft}
        tagInputLabel={t("tagInput")}
        tagSuggestions={tagSuggestions}
        selection={{ partialTagNames, collectionMixed, onRemoveAllTags: onBulkRemoveAllTags }}
        disabled={busy || count === 0 || pendingAddTag || pendingRemoveTag || pendingAddCollection || pendingClearCollection}
        onTagInputChange={onTagDraftChange}
        onCollectionInputChange={onCollectionDraftChange}
        onAddTag={onBulkAddTag}
        onRemoveTag={onBulkRemoveTag}
        onSetCollection={onBulkAddCollection}
        onClearCollection={onBulkClearCollection}
      />
    </OrganizerDrawer>
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
