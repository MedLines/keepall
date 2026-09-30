"use client";

import { type Ref } from "react";
import type {
  LibraryLayout,
  LibrarySort,
  LibraryTypeFilter,
} from "@/domain/library-view";
import { openCaptureDialog } from "./capture-events";
import {
  LibraryBulkPanels,
  LibraryBulkToolbar,
  type LibraryBulkBarProps,
  type LibraryBulkToolbarProps,
} from "./library-bulk-bar";
import {
  CloseIcon,
  DeleteIcon,
  GridIcon,
  ListIcon,
  PlusIcon,
  SearchIcon,
  SortAscIcon,
  SortDescIcon,
} from "./shell-icons";
import type { LibrarySidebarCounts } from "./library-sidebar-counts";
import { LibraryTypeFilterMenu } from "./library-type-filter-menu";
import { ShellPanelIcon } from "./shell-panel-icon";
import { ShellTopMenu } from "./shell-top-menu";
import { ThemeControl } from "./theme-control";

type Props = {
  headingRef: Ref<HTMLHeadingElement>;
  title: string;
  trash?: boolean;
  trashEmptyDisabled?: boolean;
  onEmptyTrash?: () => void;
  itemCount: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sort: LibrarySort;
  onSortChange: (sort: LibrarySort) => void;
  layout: LibraryLayout;
  onLayoutChange: (layout: LibraryLayout) => void;
  typeFilter: LibraryTypeFilter | null;
  typeCounts: LibrarySidebarCounts;
  onTypeFilterChange: (type: LibraryTypeFilter | null) => void;
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
  collectionsView?: boolean;
  tagsView?: boolean;
  libraryLoading?: boolean;
};

function LibraryBulkActions({ bulk, selection, itemCount }: { bulk: LibraryBulkBarProps | undefined; selection?: LibraryBulkToolbarProps; itemCount: number }) {
  const toolbar = selection ?? bulk;
  if (!toolbar) return null;
  if (toolbar.count > 0) return <LibraryBulkToolbar {...toolbar} />;
  if (itemCount > 0) {
    return (
      <button
        className="ui-control inline-flex h-10 shrink-0 items-center justify-center px-3 text-xs font-medium text-text-primary"
        disabled={toolbar.busy}
        type="button"
        onClick={toolbar.onSelectAllVisible}
      >
        Select all
      </button>
    );
  }
  return null;
}

export function LibraryTopBar({
  headingRef, title, itemCount, searchQuery, onSearchChange,
  sort, onSortChange, layout, onLayoutChange, panelOpen, onPanelOpenChange,
  typeFilter, typeCounts, onTypeFilterChange, tagFilterName,
  searchPlaceholder, typeFilterName, onClearSearchFilter, onClearTypeFilter,
  onClearTagFilter, onClearFilters, bulk, selection, collectionsView = false, tagsView = false, libraryLoading = false, trash = false, trashEmptyDisabled, onEmptyTrash,
}: Props) {
  const hasSearchFilter = searchQuery.trim().length > 0;
  const hasFilters = hasSearchFilter || typeFilterName !== null || tagFilterName !== null;

  function clearWithSearchFocus(action: () => void) {
    document.getElementById("library-search")?.focus();
    action();
  }

  return (
    <header className="library-top-bar relative z-40 flex shrink-0 flex-col gap-3 px-3 pb-6 pt-4 sm:px-6 sm:pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:flex-nowrap">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
          <button
            type="button"
            className="ui-control flex size-10 shrink-0 items-center justify-center text-text-primary"
            aria-label={panelOpen ? "Collapse" : "Expand"}
            title={panelOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={panelOpen}
            aria-controls="library-sidebar"
            onClick={() => onPanelOpenChange(!panelOpen)}
          >
            <ShellPanelIcon open={panelOpen} />
          </button>
          <label className="relative block min-w-[140px] flex-1 sm:max-w-[250px]" htmlFor="library-search">
            <span className="sr-only">Search</span>
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
            <input
              className="ui-field h-10 w-full pl-10 pr-3 text-sm"
              id="library-search"
              type="search"
              placeholder={collectionsView ? "Search collections…" : tagsView ? "Search tags…" : searchPlaceholder ?? (trash ? "Search Trash…" : "Search your library…")}
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
          <div className="flex shrink-0 items-center gap-2">
            {!collectionsView && !tagsView ? <LibraryTypeFilterMenu
              value={typeFilter}
              counts={typeCounts}
              loading={libraryLoading}
              onChange={onTypeFilterChange}
            /> : null}
            <ShellTopMenu
              ariaLabel="Sort library"
              iconOnly
              value={sort}
              options={[
                { value: "newest", label: "Newest", icon: <SortDescIcon /> },
                { value: "oldest", label: "Oldest", icon: <SortAscIcon /> },
              ]}
              onChange={onSortChange}
            />
            <div className="library-layout-switch icon-segmented-switch squircle-panel relative isolate flex h-11 rounded-control-lg bg-bg-raised p-0.5" role="group" aria-label="Library layout" data-layout={layout} data-selected={layout === "list" ? "end" : "start"}>
              <span aria-hidden="true" className="library-layout-thumb icon-segmented-thumb squircle-panel ui-selected pointer-events-none absolute left-0.5 top-0.5 h-10 w-[42px] rounded-control-sm" />
              {([
                { value: "grid", label: "Grid view", icon: <GridIcon /> },
                { value: "list", label: "List view", icon: <ListIcon /> },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-label={option.label}
                  title={option.label}
                  aria-pressed={layout === option.value}
                  className={`squircle-panel relative flex size-10 w-[42px] items-center justify-center rounded-control-sm ${layout === option.value ? "text-text-primary" : "text-text-secondary hover:text-text-primary"}`}
                  onClick={() => onLayoutChange(option.value)}
                >
                  {option.icon}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex w-full shrink-0 items-center justify-end gap-3 sm:w-auto">
          <ThemeControl compact />
          {trash ? <button type="button" disabled={trashEmptyDisabled} onClick={onEmptyTrash} className="ui-control inline-flex h-11 items-center justify-center gap-2 px-4 text-sm text-text-danger disabled:opacity-50"><DeleteIcon className="size-4" /><span className="leading-none">Empty Trash</span></button> : <button
            type="button"
            className="ui-control ui-primary inline-flex h-11 shrink-0 items-center gap-2 rounded-control-lg ps-3 pe-4 text-sm font-medium"
            onClick={() => openCaptureDialog()}
          >
            <PlusIcon />
            Save item
          </button>}
        </div>
      </div>

      <div data-library-toolbar-row className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div data-library-toolbar-left className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 sm:min-w-[220px] sm:flex-1">
          <div className="flex min-w-0 items-center gap-3">
          <h1 ref={headingRef} id="library-heading" tabIndex={-1} className="min-w-0 truncate text-2xl font-semibold leading-[34px] text-text-primary sm:text-[28px]">
            {title}
          </h1>
          <span className="squircle-panel flex h-6 min-w-9 shrink-0 items-center justify-center rounded-control-sm bg-bg-raised px-2 text-xs tabular-nums text-text-secondary" aria-label={libraryLoading ? "Loading items" : `${itemCount} ${collectionsView ? "collections" : tagsView ? "tags" : "items"}`}>
            {libraryLoading ? "…" : itemCount}
          </span>
          </div>

          {hasFilters ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label="Active filters">
          <span className="shrink-0 text-xs text-text-secondary">Filtered by</span>
          {hasSearchFilter ? (
            <button type="button" className="ui-control inline-flex h-8 min-w-0 max-w-full items-center gap-1.5 px-2.5 text-xs text-text-secondary sm:max-w-[320px]" aria-label={`Remove search filter: ${searchQuery}`} title={`Remove search filter: ${searchQuery}`} onClick={() => clearWithSearchFocus(onClearSearchFilter)}>
              <span className="shrink-0">Search</span><span aria-hidden="true">·</span><span className="min-w-0 truncate">{searchQuery}</span><CloseIcon className="size-4 shrink-0" />
            </button>
          ) : null}
          {typeFilterName ? (
            <button type="button" className="ui-control inline-flex h-8 min-w-0 max-w-full items-center gap-1.5 px-2.5 text-xs text-text-secondary sm:max-w-[320px]" aria-label={`Remove type filter: ${typeFilterName}`} title={`Remove type filter: ${typeFilterName}`} onClick={() => clearWithSearchFocus(onClearTypeFilter)}>
              <span className="shrink-0">Type</span><span aria-hidden="true">·</span><span className="min-w-0 truncate">{typeFilterName}</span><CloseIcon className="size-4 shrink-0" />
            </button>
          ) : null}
          {tagFilterName ? (
            <button type="button" className="ui-control inline-flex h-8 min-w-0 max-w-full items-center gap-1.5 px-2.5 text-xs text-text-secondary sm:max-w-[320px]" aria-label={`Remove tag filter: ${tagFilterName}`} title={`Remove tag filter: ${tagFilterName}`} onClick={() => clearWithSearchFocus(onClearTagFilter)}>
              <span className="shrink-0">Tag</span><span aria-hidden="true">·</span><span className="min-w-0 truncate">{tagFilterName}</span><CloseIcon className="size-4 shrink-0" />
            </button>
          ) : null}
          <button type="button" className="rounded-control px-2.5 py-1.5 text-xs font-medium text-text-primary underline-offset-4 hover:underline" onClick={() => clearWithSearchFocus(onClearFilters)}>Clear filters</button>
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 max-w-full justify-end sm:shrink">
          <LibraryBulkActions bulk={bulk} selection={selection} itemCount={itemCount} />
        </div>
      </div>

      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {(selection ?? bulk)?.count ? `${(selection ?? bulk)?.count} selected, ${(selection ?? bulk)?.hiddenCount ?? 0} hidden by search or filters` : "No items selected"}
      </span>

      {!selection && bulk && (bulk.panel !== null || bulk.error) ? <LibraryBulkPanels {...bulk} count={bulk.panelCount ?? bulk.count} hiddenCount={bulk.panelHiddenCount ?? bulk.hiddenCount} /> : null}
    </header>
  );
}
