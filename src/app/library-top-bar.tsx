"use client";

import { type Ref } from "react";
import type { LibraryLayout, LibrarySort } from "@/domain/library-view";
import { GridIcon, ListIcon, PanelIcon, SearchIcon } from "./shell-icons";
import {
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
  onBrowseOpen?: () => void;
  showBrowseOpen?: boolean;
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
  onBrowseOpen,
  showBrowseOpen = false,
}: Props) {
  return (
    <header className="shrink-0 bg-white px-4 py-3 shadow-[0_1px_0_rgba(0,0,0,0.06)] sm:px-5">
      <div className="flex flex-wrap items-center gap-3 gap-y-2">
        {showBrowseOpen && onBrowseOpen ? (
          <button
            type="button"
            className={`${SHELL_TOP_BTN} ${SHELL_TOP_BTN_IDLE} md:hidden`}
            aria-label="Open browse panel"
            onClick={onBrowseOpen}
          >
            <PanelIcon />
            Browse
          </button>
        ) : null}

        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Library
          </p>
          <h2
            ref={headingRef}
            className="sr-only"
            id="library-heading"
            tabIndex={-1}
          >
            Library
          </h2>
          <h1 className="text-balance text-base font-semibold tracking-tight text-zinc-900">
            {title}
          </h1>
          <p className="text-xs tabular-nums text-zinc-500">
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </p>
        </div>

        <div className="order-last w-full sm:order-none sm:ml-auto sm:w-auto sm:max-w-md sm:flex-1">
          <label className="relative block" htmlFor="library-search">
            <span className="sr-only">Search</span>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              className="w-full rounded-[10px] border border-zinc-200/80 bg-white py-2 pl-9 pr-3 text-sm shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.03)] outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-zinc-400 focus:shadow-[0_0_0_3px_rgba(24,24,27,0.08)]"
              id="library-search"
              type="search"
              placeholder="Search titles, notes, and URLs"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
        </div>

        <div className="flex items-center gap-1.5" role="group" aria-label="Sort library">
          <TopToggle
            active={sort === "newest"}
            label="Newest"
            onClick={() => onSortChange("newest")}
          />
          <TopToggle
            active={sort === "oldest"}
            label="Oldest"
            onClick={() => onSortChange("oldest")}
          />
        </div>

        <div className="flex items-center gap-1.5" role="group" aria-label="Library layout">
          <TopToggle
            active={layout === "grid"}
            label="Grid"
            icon={GridIcon}
            onClick={() => onLayoutChange("grid")}
          />
          <TopToggle
            active={layout === "list"}
            label="List"
            icon={ListIcon}
            onClick={() => onLayoutChange("list")}
          />
        </div>

        <p className="hidden text-xs text-zinc-500 lg:block">
          <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-medium text-zinc-600">
            ⌥K
          </kbd>{" "}
          to save
        </p>
      </div>
    </header>
  );
}

function TopToggle({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon?: typeof GridIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${SHELL_TOP_BTN} ${active ? SHELL_TOP_BTN_ACTIVE : SHELL_TOP_BTN_IDLE}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {Icon ? <Icon /> : null}
      {label}
    </button>
  );
}
