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
  SHELL_SIDEBAR_EXPANDED,
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
  const showBulkSlot = bulk !== undefined && bulk.visibleCount > 0;
  const bulkPanelOpen = bulk?.panel !== null && bulk?.panel !== undefined;

  return (
    <header className="shrink-0 border-b border-zinc-200/80 bg-white">
      <div className="flex min-h-11 items-stretch">
        <div
          className={`${SHELL_SIDEBAR_EXPANDED} flex shrink-0 items-center border-r border-zinc-200/80 px-3`}
        >
          <Link
            href="/"
            className={`${SHELL_NAV_ITEM} ${SHELL_NAV_ITEM_IDLE} min-w-0 flex-1 gap-2 px-2 text-zinc-900`}
            aria-label="Keepall home"
            onClick={() => onHomeClick?.()}
          >
            <LogoIcon />
            <span className="truncate font-semibold">Keepall</span>
          </Link>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-11 min-w-0 items-center gap-2 px-3 py-1 sm:gap-2 sm:px-4">
            <div className="hidden min-w-0 shrink-0 sm:block sm:w-28 lg:w-32">
              <h2
                ref={headingRef}
                className="sr-only"
                id="library-heading"
                tabIndex={-1}
              >
                Library
              </h2>
              <p className="truncate text-sm font-semibold text-zinc-900">{title}</p>
              <p className="text-[11px] tabular-nums text-zinc-500">
                {libraryLoading
                  ? "Loading…"
                  : `${itemCount} item${itemCount === 1 ? "" : "s"}`}
              </p>
            </div>

            {showBulkSlot ? (
              <div
                className="flex min-h-8 min-w-[12rem] flex-1 items-center overflow-hidden"
                aria-hidden={bulk!.count === 0}
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

            <div className="min-w-0 shrink-0 sm:w-44 lg:w-52">
              <label className="relative block" htmlFor="library-search">
                <span className="sr-only">Search</span>
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                <input
                  className="h-8 w-full rounded-[10px] border border-zinc-200/80 bg-zinc-50 pl-8 pr-2.5 text-sm outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-zinc-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(24,24,27,0.08)]"
                  id="library-search"
                  type="search"
                  placeholder="Search…"
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

      <div className="border-t border-zinc-100 px-3 py-1.5 sm:hidden">
        <p className="truncate text-sm font-semibold text-zinc-900">{title}</p>
        <p className="text-[11px] tabular-nums text-zinc-500">
          {libraryLoading
            ? "Loading…"
            : `${itemCount} item${itemCount === 1 ? "" : "s"}`}
        </p>
      </div>
    </header>
  );
}
