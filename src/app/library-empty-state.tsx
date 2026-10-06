"use client";

import Link from "next/link";
import type { LibraryViewState } from "@/domain/library-view";
import { openBulkImportDialog, openCaptureDialog } from "./capture-events";
import { LibraryFolderArtwork } from "./library-collections";
import { SearchIcon, DeleteIcon } from "./shell-icons";

export type LibraryEmptyStateKind = "library" | "collection" | "unsorted" | "trash" | "filtered" | "first-save";

export function getEmptyStateKind(view: LibraryViewState, hasActiveSearch: boolean, libraryCount: number): LibraryEmptyStateKind {
  if (hasActiveSearch || view.type !== null || view.tag !== null) return "filtered";
  if (view.trash) return "trash";
  if (view.unsorted) return "unsorted";
  if (view.collection !== null) return "collection";
  return libraryCount === 0 ? "first-save" : "library";
}

export function entireLibrarySearch(view: LibraryViewState): Partial<LibraryViewState> | null {
  if (view.trash || view.collections || view.tags || !view.q.trim() || !(view.collection || view.unsorted || view.tag || view.type)) return null;
  return { q: view.q, collection: null, unsorted: false, tag: null, type: null, item: null, slide: 0 };
}

type Props = {
  kind: LibraryEmptyStateKind;
  message: string;
  query?: string;
  scope?: string;
  onClearFilters: () => void;
  onSearchEntireLibrary?: () => void;
};

export function LibraryEmptyState({ kind, message, query, scope, onClearFilters, onSearchEntireLibrary }: Props) {
  const firstSave = kind === "first-save";
  const canSave = firstSave || kind === "library" || kind === "collection" || kind === "unsorted";
  const description = firstSave ? "Keep links, notes, images, videos, and documents together. Save something you want to come back to, or bring in files and bookmarks you already have."
    : kind === "collection" ? "Save an item here, or move an existing item into this collection."
    : kind === "unsorted" ? "Items without a collection appear here. New saves stay here until you organize them."
    : kind === "trash" ? "Deleted items appear here until you restore them or empty the trash."
    : kind === "filtered" ? "Try another search or clear the active filters."
    : "Save an item to add it to your library.";
  const title = firstSave ? "A place for what you want to keep" : query?.trim() ? `No results for “${query.trim()}”` : message;
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-12 text-center sm:py-16">
      {canSave ? (
        <div className="mb-6 w-44 max-w-full pointer-events-none" aria-hidden="true">
          <LibraryFolderArtwork previews={[]} itemTypes={[]} />
        </div>
      ) : (
        <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-bg-active text-text-secondary" aria-hidden="true">
          {kind === "trash" ? <DeleteIcon className="size-6" /> : <SearchIcon className="size-6" />}
        </div>
      )}
      <h2 className="max-w-full break-words text-xl font-semibold tracking-tight text-text-primary">{title}</h2>
      {query?.trim() && scope ? <p className="mt-2 max-w-full break-words text-sm text-text-secondary">Searching {scope}</p> : null}
      <p className="mt-3 max-w-md text-sm leading-relaxed text-text-secondary">{description}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {canSave ? <button type="button" className="ui-control ui-primary min-h-11 px-4 py-2 text-sm font-medium" onClick={openCaptureDialog}>{firstSave ? "Save your first item" : "Save an item"}</button> : null}
        {firstSave ? <button type="button" className="ui-control min-h-11 px-4 py-2 text-sm font-medium" onClick={openBulkImportDialog}>Import bookmarks or files</button> : null}
        {kind === "filtered" ? <>
          {onSearchEntireLibrary ? <button type="button" className="ui-control ui-primary min-h-11 px-4 py-2 text-sm font-medium" onClick={onSearchEntireLibrary}>Search entire library</button> : null}
          <button type="button" className="ui-control min-h-11 px-4 py-2 text-sm font-medium" onClick={onClearFilters}>Clear filters</button>
        </> : null}
      </div>
    </section>
  );
}
