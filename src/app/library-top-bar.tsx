"use client";

import type { ReactNode, Ref } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import type {
  LibraryLayout,
  LibraryListColumns,
  LibrarySort,
  LibraryTypeSelection,
} from "@/domain/library-view";
import { useAppShortcuts } from "./use-app-shortcuts";
import { shortcutLabel } from "@/domain/keyboard-shortcuts";
import { openCaptureDialog } from "./capture-events";
import {
  LibraryBulkPanels,
  LibraryBulkToolbar,
  type LibraryBulkBarProps,
  type LibraryBulkToolbarProps,
} from "./library-bulk-bar";
import {
  CloseIcon,
  ColumnsIcon,
  DeleteIcon,
  DownloadIcon,
  EyeIcon,
  GridIcon,
  ListIcon,
  PlusIcon,
  RelevanceIcon,
  SearchIcon,
  SortAscIcon,
  SortDescIcon,
} from "./shell-icons";
import type { LibrarySidebarCounts } from "./library-sidebar-counts";
import { LibraryTypeFilterMenu } from "./library-type-filter-menu";
import { ShellPanelIcon } from "./shell-panel-icon";
import { ShellTopMenu } from "./shell-top-menu";
import { ThemeControl } from "./theme-control";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { buttonClassName, iconButtonClassName } from "@/components/ui/button";

type Props = {
  headingRef: Ref<HTMLHeadingElement>;
  title: string;
  trash?: boolean;
  trashEmptyDisabled?: boolean;
  onEmptyTrash?: () => void;
  itemCount: number;
  searchQuery: string;
  searchPending?: boolean;
  onSearchChange: (value: string) => void;
  sort: LibrarySort;
  onSortChange: (sort: LibrarySort) => void;
  layout: LibraryLayout;
  onLayoutChange: (layout: LibraryLayout) => void;
  listColumns?: LibraryListColumns;
  onListColumnsChange?: (columns: LibraryListColumns) => void;
  onPreview?: () => void;
  previewDisabled?: boolean;
  /** Export the current results as a Context Pack. */
  onExport?: () => void;
  typeFilter: LibraryTypeSelection;
  typeCounts: LibrarySidebarCounts;
  onTypeFilterChange: (type: LibraryTypeSelection) => void;
  tagFilterName: string | null;
  searchPlaceholder?: string;
  typeFilterName: string | null;
  onClearSearchFilter: () => void;
  onClearTypeFilter: () => void;
  onClearTagFilter: () => void;
  onClearFilters: () => void;
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  bulk?: LibraryBulkBarProps;
  selection?: LibraryBulkToolbarProps;
  /** Transient notice (undo) that borrows the action slot while nothing is selected. */
  notice?: ReactNode;
  collectionsView?: boolean;
  tagsView?: boolean;
  libraryLoading?: boolean;
};

function LibraryBulkActions({ bulk, selection, notice }: { bulk: LibraryBulkBarProps | undefined; selection?: LibraryBulkToolbarProps; notice?: ReactNode }) {
  const toolbar = selection ?? bulk;
  // Selection actions own the slot; a pending notice reappears once it clears.
  if (toolbar && toolbar.count > 0) return <LibraryBulkToolbar {...toolbar} />;
  if (notice) return <>{notice}</>;
  return toolbar ? <LibraryBulkToolbar {...toolbar} /> : null;
}

export function LibraryTopBar({
  headingRef, title, itemCount, searchQuery, searchPending = false, onSearchChange,
  sort, onSortChange, layout, onLayoutChange, listColumns = "auto", onListColumnsChange, onPreview, previewDisabled = false, onExport, panelOpen, onPanelOpenChange,
  typeFilter, typeCounts, onTypeFilterChange, tagFilterName,
  searchPlaceholder, typeFilterName, onClearSearchFilter, onClearTypeFilter,
  onClearTagFilter, onClearFilters, bulk, selection, notice, collectionsView = false, tagsView = false, libraryLoading = false, trash = false, trashEmptyDisabled, onEmptyTrash,
}: Props) {
  const shortcuts = useAppShortcuts({
    search: () => document.getElementById("library-search")?.focus(),
    toggleLayout: () => onLayoutChange(layout === "grid" ? "list" : "grid"),
  });
  const hasSearchFilter = searchQuery.trim().length > 0;
  const canSortByRelevance = hasSearchFilter && !collectionsView && !tagsView;
  const hasFilters = hasSearchFilter || typeFilterName !== null || tagFilterName !== null;

  function clearWithSearchFocus(action: () => void) {
    document.getElementById("library-search")?.focus();
    action();
  }

  return (
    <header className="library-top-bar @container/toolbar relative z-40 flex shrink-0 flex-col gap-3 px-3 pb-6 pt-4 sm:px-6 sm:pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 @min-[44rem]/toolbar:flex-nowrap">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 @min-[44rem]/toolbar:flex-nowrap @min-[44rem]/toolbar:gap-3">
          <Tooltip content={panelOpen ? "Collapse sidebar" : "Expand sidebar"}>
            <button
              type="button"
              className={iconButtonClassName({ className: "text-text-primary" })}
              aria-label={panelOpen ? "Collapse" : "Expand"}
              aria-expanded={panelOpen}
              aria-controls="library-sidebar"
              onClick={() => onPanelOpenChange(!panelOpen)}
            >
              <ShellPanelIcon open={panelOpen} />
            </button>
          </Tooltip>
          <div className="relative min-w-[140px] flex-1 sm:max-w-[250px]">
            <label className="sr-only" htmlFor="library-search">Search</label>
            <span role="status" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-secondary">
              <SearchIcon className={`size-4 transition-[visibility] duration-0 ${searchPending ? "invisible delay-200" : "visible"}`} />
              <span aria-hidden="true" className={`absolute inset-0 size-4 rounded-full border-2 border-current border-t-transparent transition-[visibility] duration-0 ${searchPending ? "visible delay-200 animate-spin motion-reduce:animate-none" : "invisible"}`} />
              <span className="sr-only">{searchPending ? "Searching file contents…" : ""}</span>
            </span>
            <input
              className="ui-field h-10 w-full pl-10 pr-11 text-sm"
              aria-keyshortcuts={shortcuts.search.replace(/Key|Digit/g, "").replace("Slash", "/")}
              id="library-search"
              type="search"
              aria-description={collectionsView || tagsView ? undefined : 'Search words in any order. Use "quotes" for an exact phrase.'}
              placeholder={collectionsView ? "Search collections…" : tagsView ? "Search tags…" : searchPlaceholder ?? (trash ? "Search Trash…" : "Search your library…")}
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
            />
            {!searchQuery ? <kbd aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 max-w-[40%] -translate-y-1/2 truncate text-2xs text-text-secondary">{shortcutLabel(shortcuts.search)}</kbd> : null}
            {searchQuery ? <button type="button" aria-label="Clear search"
              className="control-shape-none group absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-none text-text-secondary focus-visible:outline-1 focus-visible:-outline-offset-4 focus-visible:outline-border-focus"
              onClick={() => clearWithSearchFocus(() => onSearchChange(""))}>
              <span className="flex size-7 items-center justify-center rounded-full group-hover:bg-bg-raised group-hover:text-text-primary"><CloseIcon className="size-4" /></span>
            </button> : null}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {!collectionsView && !tagsView ? <LibraryTypeFilterMenu
              value={typeFilter}
              counts={typeCounts}
              loading={libraryLoading}
              onChange={onTypeFilterChange}
            /> : null}
            <ShellTopMenu<LibrarySort>
              ariaLabel="Sort library"
              iconOnly
              value={!canSortByRelevance && sort === "relevance" ? "newest" : sort}
              options={[
                { value: "newest", label: "Newest first", icon: <SortDescIcon /> },
                ...(canSortByRelevance ? [{ value: "relevance" as const, label: "Best match", icon: <RelevanceIcon /> }] : []),
                { value: "oldest", label: "Oldest first", icon: <SortAscIcon /> },
              ]}
              onChange={onSortChange}
            />
            <SegmentedControl
              variant="icon"
              label="Library layout"
              className="library-layout-switch"
              thumbClassName="library-layout-thumb"
              data-layout={layout}
              aria-keyshortcuts={shortcuts.toggleLayout.replace(/Key|Digit/g, "").replace("Slash", "/")}
              value={layout}
              onChange={onLayoutChange}
              choices={[
                { value: "grid", ariaLabel: "Grid view", icon: <GridIcon />, tooltip: `Grid view · ${shortcutLabel(shortcuts.toggleLayout)}` },
                { value: "list", ariaLabel: "List view", icon: <ListIcon />, tooltip: `List view · ${shortcutLabel(shortcuts.toggleLayout)}` },
              ]}
            />
            {layout === "list" && !collectionsView && !tagsView && onListColumnsChange ? <ShellTopMenu<LibraryListColumns>
              ariaLabel="List columns"
              iconOnly
              triggerIcon={<ColumnsIcon />}
              value={listColumns}
              options={[
                { value: "auto", label: "Auto" },
                { value: "1", label: "1 column" },
                { value: "2", label: "2 columns" },
                { value: "3", label: "3 columns" },
              ]}
              onChange={onListColumnsChange}
            /> : null}
            {!trash && !collectionsView && !tagsView && onPreview ? <Tooltip content={`Preview current results · ${shortcutLabel(shortcuts.preview)}`}>
              <button type="button" aria-keyshortcuts={shortcuts.preview.replace(/Key|Digit/g, "").replace("Slash", "/")} aria-label="Preview" aria-haspopup="dialog"
                className={buttonClassName({ size: "toolbar", className: "px-3" })}
                disabled={previewDisabled} onClick={onPreview}>
                <EyeIcon className="size-4" /><span className="hidden @min-[54rem]/toolbar:inline">Preview</span>
              </button>
            </Tooltip> : null}
            {!trash && !collectionsView && !tagsView && onExport ? <Tooltip content="Export these results for an AI agent">
              <button type="button" aria-label="Export" aria-haspopup="dialog"
                className={buttonClassName({ size: "toolbar", className: "px-3" })}
                disabled={previewDisabled} onClick={onExport}>
                <DownloadIcon className="size-4" /><span className="hidden @min-[54rem]/toolbar:inline">Export</span>
              </button>
            </Tooltip> : null}
          </div>
        </div>
        <div className="flex w-full shrink-0 items-center justify-end gap-3 @min-[44rem]/toolbar:w-auto">
          <ThemeControl compact />
          {trash ? <button type="button" disabled={trashEmptyDisabled} onClick={onEmptyTrash} className={buttonClassName({ variant: "danger-ghost", size: "toolbar", className: "px-4" })}><DeleteIcon className="size-4" /><span className="leading-none">Empty Trash</span></button> : <Tooltip content={`Save item · ${shortcutLabel(shortcuts.capture)}`} describe={false}>
            <button
              type="button"
              aria-keyshortcuts={shortcuts.capture.replace(/Key|Digit/g, "").replace("Slash", "/")}
              className={buttonClassName({ variant: "primary", size: "toolbar", className: "ps-3 pe-4 font-medium" })}
              onClick={() => openCaptureDialog()}
            >
              <PlusIcon />
              Save item
            </button>
          </Tooltip>}
        </div>
      </div>

      <div data-library-toolbar-row className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div data-library-toolbar-left className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 sm:flex-1">
          <div className="flex min-w-0 items-center gap-3">
          <h1 ref={headingRef} id="library-heading" tabIndex={-1} className="min-w-0 truncate text-2xl font-semibold leading-[34px] text-text-primary sm:text-display">
            {title}
          </h1>
          <span className="flex h-6 min-w-9 shrink-0 items-center justify-center rounded-control-sm bg-bg-raised px-2 text-xs tabular-nums text-text-secondary" aria-label={libraryLoading ? "Loading items" : `${itemCount} ${collectionsView ? "collections" : tagsView ? "tags" : "items"}`}>
            {libraryLoading ? "…" : itemCount}
          </span>
          </div>

          {hasFilters ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label="Active filters">
          <span className="shrink-0 text-xs text-text-secondary">Filtered by</span>
          {hasSearchFilter ? (
            <button type="button" className={buttonClassName({ size: "none", className: "h-8 min-w-0 max-w-full gap-1.5 px-2.5 text-xs text-text-secondary sm:max-w-[320px] justify-start" })} aria-label={`Remove search filter: ${searchQuery}`} onClick={() => clearWithSearchFocus(onClearSearchFilter)}>
              <span className="shrink-0">Search</span><span aria-hidden="true">·</span><span className="min-w-0 truncate">{searchQuery}</span><CloseIcon className="size-4 shrink-0" />
            </button>
          ) : null}
          {typeFilterName ? (
            <button type="button" className={buttonClassName({ size: "none", className: "h-8 min-w-0 max-w-full gap-1.5 px-2.5 text-xs text-text-secondary sm:max-w-[320px] justify-start" })} aria-label={`Remove type filter: ${typeFilterName}`} onClick={() => clearWithSearchFocus(onClearTypeFilter)}>
              <span className="shrink-0">Type</span><span aria-hidden="true">·</span><span className="min-w-0 truncate">{typeFilterName}</span><CloseIcon className="size-4 shrink-0" />
            </button>
          ) : null}
          {tagFilterName ? (
            <button type="button" className={buttonClassName({ size: "none", className: "h-8 min-w-0 max-w-full gap-1.5 px-2.5 text-xs text-text-secondary sm:max-w-[320px] justify-start" })} aria-label={`Remove tag filter: ${tagFilterName}`} onClick={() => clearWithSearchFocus(onClearTagFilter)}>
              <span className="shrink-0">Tag</span><span aria-hidden="true">·</span><span className="min-w-0 truncate">{tagFilterName}</span><CloseIcon className="size-4 shrink-0" />
            </button>
          ) : null}
          <button type="button" className="px-2.5 py-1.5 text-xs font-medium text-text-primary underline-offset-4 hover:underline" onClick={() => clearWithSearchFocus(onClearFilters)}>Clear filters</button>
            </div>
          ) : null}
        </div>

        <div className="flex h-10 w-full min-w-0 shrink-0 justify-end sm:w-[min(50%,32rem)]">
          <LibraryBulkActions bulk={bulk} selection={selection} notice={notice} />
        </div>
      </div>

      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {(selection ?? bulk)?.count ? `${(selection ?? bulk)?.count} selected, ${(selection ?? bulk)?.hiddenCount ?? 0} hidden by search or filters` : "No items selected"}
      </span>

      {!selection && bulk && (bulk.panel !== null || bulk.error) ? <LibraryBulkPanels {...bulk} count={bulk.panelCount ?? bulk.count} hiddenCount={bulk.panelHiddenCount ?? bulk.hiddenCount} /> : null}
    </header>
  );
}
