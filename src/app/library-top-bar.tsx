"use client";

import Link from "next/link";
import { type Ref } from "react";
import type { LibraryLayout, LibrarySort } from "@/domain/library-view";
import { openCaptureDialog } from "./capture-events";
import { GridIcon, ListIcon, LogoIcon, SearchIcon } from "./shell-icons";
import { ShellTopMenu } from "./shell-top-menu";
import {
  SHELL_NAV_ITEM,
  SHELL_NAV_ITEM_IDLE,
  SHELL_SIDEBAR_EXPANDED,
  SHELL_TOP_BTN,
  SHELL_TOP_BTN_ACTIVE,
  SHELL_TOP_BTN_IDLE,
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
  onHomeClick?: () => void;
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
  onHomeClick,
}: Props) {
  return (
    <header className="shrink-0 border-b border-zinc-200/80 bg-white">
      <div className="flex min-h-12">
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

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
          <div className="hidden min-w-0 shrink-0 sm:block">
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
              {itemCount} item{itemCount === 1 ? "" : "s"}
            </p>
          </div>

          <div className="min-w-0 flex-1">
            <label className="relative block" htmlFor="library-search">
              <span className="sr-only">Search</span>
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                className="w-full rounded-[10px] border border-zinc-200/80 bg-zinc-50 py-1.5 pl-9 pr-3 text-sm outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-zinc-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(24,24,27,0.08)]"
                id="library-search"
                type="search"
                placeholder="Search titles, notes, URLs, and tags"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </label>
          </div>

          <ShellTopMenu
            ariaLabel="Sort library"
            value={sort}
            options={[
              { value: "newest", label: "Newest" },
              { value: "oldest", label: "Oldest" },
            ]}
            onChange={onSortChange}
          />

          <ShellTopMenu
            ariaLabel="Library layout"
            value={layout}
            options={[
              { value: "grid", label: "Grid", icon: <GridIcon /> },
              { value: "list", label: "List", icon: <ListIcon /> },
            ]}
            onChange={onLayoutChange}
          />

          <button
            type="button"
            className={`${SHELL_TOP_BTN} ${SHELL_TOP_BTN_ACTIVE}`}
            onClick={() => openCaptureDialog()}
          >
            Add
          </button>
        </div>
      </div>

      <div className="border-t border-zinc-100 px-3 py-1.5 sm:hidden">
        <p className="truncate text-sm font-semibold text-zinc-900">{title}</p>
        <p className="text-[11px] tabular-nums text-zinc-500">
          {itemCount} item{itemCount === 1 ? "" : "s"}
        </p>
      </div>
    </header>
  );
}
