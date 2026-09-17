"use client";

import Link from "next/link";
import { type Ref } from "react";
import type {
  LibraryLayout,
  LibrarySort,
  LibraryTypeFilter,
} from "@/domain/library-view";
import { LibraryTypeFilterMenu } from "./library-type-filter-menu";
import { openCaptureDialog } from "./capture-events";
import {
  LibraryBulkPanels,
  LibraryBulkToolbar,
  type LibraryBulkBarProps,
} from "./library-bulk-bar";
import {
  GridIcon,
  ListIcon,
  LogoIcon,
  SearchIcon,
  SortAscIcon,
  SortDescIcon,
} from "./shell-icons";
import { ShellTopMenu } from "./shell-top-menu";
import {
  SHELL_NAV_ITEM,
  SHELL_NAV_ITEM_IDLE,
  SHELL_TOP_BTN,
  SHELL_TOP_BTN_ACTIVE,
} from "./shell-styles";

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
  onTypeFilterChange: (type: LibraryTypeFilter | null) => void;
  onHomeClick?: () => void;
  bulk?: LibraryBulkBarProps;
  libraryLoading?: boolean;
};

export function LibraryTopBar({
  headingRef,
  title,
  itemCount,
  searchQuery,
  onSearchChange,
  sort,
  onSortChange,
  layout,
  onLayoutChange,
  typeFilter,
  onTypeFilterChange,
  onHomeClick,
  bulk,
  libraryLoading = false,
}: Props) {
  const showBulkSlot = bulk !== undefined && bulk.count > 0;
  const bulkPanelOpen = bulk?.panel !== null && bulk?.panel !== undefined;

  return (
    <header className="relative z-40 shrink-0 bg-bg-shell">
      <h2 ref={headingRef} className="sr-only" id="library-heading" tabIndex={-1}>Library</h2>
      <div className="flex flex-wrap items-center gap-y-2 px-3 py-3 md:flex-nowrap md:px-0">
        <div
          className="flex w-full shrink-0 items-center md:w-60 md:px-3"
        >
          <Link
            href="/"
            className={`${SHELL_NAV_ITEM} ${SHELL_NAV_ITEM_IDLE} min-h-10 min-w-0 gap-2 px-2 text-text-primary`}
            aria-label="Keepall home"
            onClick={() => onHomeClick?.()}
          >
            <LogoIcon />
            <span className="truncate font-semibold">Keepall</span>
          </Link>
        </div>

        <div className="flex min-w-0 flex-1 basis-full flex-col md:basis-0 md:pr-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="hidden min-w-0 max-w-44 shrink-0 pr-3 lg:block">
              <p className="truncate text-sm font-semibold text-text-primary">{title}</p>
              <p className="text-[11px] tabular-nums text-text-secondary">
                {libraryLoading
                  ? "Loading…"
                  : `${itemCount} item${itemCount === 1 ? "" : "s"}`}
              </p>
            </div>

            {showBulkSlot ? (
              <div
                className="order-last flex min-h-10 w-full min-w-0 items-center overflow-hidden"
              >
                <LibraryBulkToolbar
                  allVisibleSelected={bulk!.allVisibleSelected}
                  busy={bulk!.busy}
                  count={bulk!.count}
                  onClearSelection={bulk!.onClearSelection}
                  onOpenPanel={bulk!.onOpenPanel}
                  onSelectAllVisible={bulk!.onSelectAllVisible}
                />
              </div>
            ) : null}

            <div className="order-first w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
              <label className="relative block" htmlFor="library-search">
                <span className="sr-only">Search</span>
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
                <input
                  className="h-10 w-full rounded-control border border-border-edge bg-bg-surface pl-9 pr-3 text-sm outline-none focus:border-border-focus"
                  id="library-search"
                  type="search"
                  placeholder="Search your library…"
                  value={searchQuery}
                  onChange={(event) => onSearchChange(event.target.value)}
                />
              </label>
            </div>

            <LibraryTypeFilterMenu
              value={typeFilter}
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

            <ShellTopMenu
              ariaLabel="Library layout"
              iconOnly
              value={layout}
              options={[
                { value: "grid", label: "Grid", icon: <GridIcon /> },
                { value: "list", label: "List", icon: <ListIcon /> },
              ]}
              onChange={onLayoutChange}
            />

            <button
              type="button"
              className={`${SHELL_TOP_BTN} ${SHELL_TOP_BTN_ACTIVE} shrink-0`}
              onClick={() => openCaptureDialog()}
            >
              Add
            </button>
          </div>

          {bulk && (bulkPanelOpen || bulk.error) ? (
            <LibraryBulkPanels {...bulk} />
          ) : null}
        </div>
      </div>

      <div className="px-4 pb-3 lg:hidden">
        <p className="truncate text-sm font-semibold text-text-primary">{title}</p>
        <p className="text-[11px] tabular-nums text-text-secondary">
          {libraryLoading
            ? "Loading…"
            : `${itemCount} item${itemCount === 1 ? "" : "s"}`}
        </p>
      </div>
    </header>
  );
}
