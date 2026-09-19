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
} from "./library-bulk-bar";
import { GridIcon, ListIcon, PlusIcon, SearchIcon, SortAscIcon, SortDescIcon } from "./shell-icons";
import type { LibrarySidebarCounts } from "./library-sidebar-counts";
import { LibraryTypeFilterMenu } from "./library-type-filter-menu";
import { ShellPanelIcon } from "./shell-panel-icon";
import { ShellTopMenu } from "./shell-top-menu";
import { ThemeControl } from "./theme-control";

type Props = {
  headingRef: Ref<HTMLHeadingElement>;
  title: string;
  itemCount: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sort: LibrarySort;
  onSortChange: (sort: LibrarySort) => void;
  layout: LibraryLayout;
  onLayoutChange: (layout: LibraryLayout) => void;
  typeFilter: LibraryTypeFilter | null;
  sidebarCounts: LibrarySidebarCounts;
  onTypeFilterChange: (type: LibraryTypeFilter | null) => void;
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  bulk?: LibraryBulkBarProps;
  libraryLoading?: boolean;
};

export function LibraryTopBar({
  headingRef, title, itemCount, searchQuery, onSearchChange,
  sort, onSortChange, layout, onLayoutChange, panelOpen, onPanelOpenChange,
  typeFilter, sidebarCounts, onTypeFilterChange, bulk, libraryLoading = false,
}: Props) {
  const hasSelection = Boolean(bulk && bulk.count > 0);

  return (
    <header className="relative z-40 flex shrink-0 flex-col gap-6 px-3 pb-6 pt-4 sm:px-6 sm:pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:flex-nowrap">
        <div className="flex min-w-0 flex-1 items-center gap-3">
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
          <label className="relative block min-w-0 flex-1 sm:max-w-[250px]" htmlFor="library-search">
            <span className="sr-only">Search</span>
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
            <input
              className="ui-field h-10 w-full pl-10 pr-3 text-sm"
              id="library-search"
              type="search"
              placeholder="Search your library…"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
        </div>
        <div className="flex w-full shrink-0 items-center justify-end gap-3 sm:w-auto">
          <ThemeControl compact />
          <button
            type="button"
            className="ui-control ui-primary inline-flex h-11 shrink-0 items-center gap-2 rounded-control-lg px-4 text-sm font-medium"
            onClick={() => openCaptureDialog()}
          >
            <PlusIcon />
            Save item
          </button>
        </div>
      </div>

      <div className="grid min-h-[98px] grid-cols-1 content-start gap-3 sm:min-h-[42px] sm:grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto] sm:items-center">
        <div className={`${hasSelection ? "hidden sm:flex sm:max-w-[18rem]" : "flex"} row-start-1 min-w-0 items-center gap-3 sm:col-start-1 sm:row-start-1`}>
          <h1 ref={headingRef} id="library-heading" tabIndex={-1} className="min-w-0 truncate text-2xl font-semibold leading-[34px] text-text-primary sm:text-[28px]">
            {title}
          </h1>
          <span className="squircle-panel flex h-6 min-w-9 shrink-0 items-center justify-center rounded-control-sm bg-bg-raised px-2 text-xs tabular-nums text-text-secondary" aria-label={libraryLoading ? "Loading items" : `${itemCount} items`}>
            {libraryLoading ? "…" : itemCount}
          </span>
        </div>
        <div className={`${hasSelection ? "block" : "hidden"} row-start-1 min-w-0 sm:col-start-2 sm:row-start-1 sm:block`}>
          {hasSelection && bulk ? (
            <LibraryBulkToolbar
              allVisibleSelected={bulk.allVisibleSelected}
              busy={bulk.busy}
              count={bulk.count}
              onClearSelection={bulk.onClearSelection}
              onOpenPanel={bulk.onOpenPanel}
              onSelectAllVisible={bulk.onSelectAllVisible}
            />
          ) : null}
        </div>
        <div className="row-start-2 flex shrink-0 items-center justify-end gap-2 sm:col-start-3 sm:row-start-1">
          <LibraryTypeFilterMenu
            value={typeFilter}
            counts={sidebarCounts}
            loading={libraryLoading}
            onChange={onTypeFilterChange}
          />
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
          <div className="library-layout-switch squircle-panel relative isolate flex h-11 rounded-control-lg bg-bg-control p-0.5" role="group" aria-label="Library layout" data-layout={layout}>
            <span aria-hidden="true" className="library-layout-thumb squircle-panel ui-selected pointer-events-none absolute left-0.5 top-0.5 h-10 w-[42px] rounded-control-sm" />
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

      {bulk && (bulk.panel !== null || bulk.error) ? <LibraryBulkPanels {...bulk} /> : null}
    </header>
  );
}
