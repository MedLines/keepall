"use client";

import Link from "next/link";
import type { LibraryViewState } from "@/domain/library-view";
import { openBulkImportDialog, openCaptureDialog } from "./capture-events";
import { LibraryFolderArtwork } from "./library-collections";
import { SearchIcon, DeleteIcon } from "./shell-icons";
import "./library-empty-state.css";

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
  const description = firstSave ? "Save links, notes, images, videos, and documents in one place."
    : kind === "collection" ? "Save an item here, or move an existing item into this collection."
    : kind === "unsorted" ? "Items without a collection appear here. New saves stay here until you organize them."
    : kind === "trash" ? "Deleted items appear here until you restore them or empty the trash."
    : kind === "filtered" ? "Try another search or clear the active filters."
    : "Save an item to add it to your library.";
  const title = firstSave ? "Start your library" : query?.trim() ? `No results for “${query.trim()}”` : message;
  return (
    <section className="library-empty-state">
      {canSave ? (
        <div className="library-empty-illustration" aria-hidden="true">
          <span className="library-empty-glow" />
          <LibraryFolderArtwork previews={[]} itemTypes={[]} emptyState />
        </div>
      ) : (
        <div className="library-empty-symbol text-text-secondary" aria-hidden="true">
          {kind === "trash" ? <DeleteIcon className="size-5" /> : <SearchIcon className="size-5" />}
        </div>
      )}
      <h2 className="library-empty-title text-text-primary">{title}</h2>
      {query?.trim() && scope ? <p className="library-empty-scope text-text-secondary">Searching {scope}</p> : null}
      <p className="library-empty-description text-text-secondary">{description}</p>
      <div className="library-empty-actions">
        {canSave ? <button type="button" className="ui-control ui-primary library-empty-action" onClick={openCaptureDialog}>{firstSave ? "Save first item" : "Save an item"}</button> : null}
        {firstSave ? <button type="button" className="ui-control library-empty-action" onClick={openBulkImportDialog} title="Import bookmarks or files">Import items</button> : null}
        {kind === "filtered" ? <>
          {onSearchEntireLibrary ? <button type="button" className="ui-control ui-primary library-empty-action" onClick={onSearchEntireLibrary}>Search entire library</button> : null}
          <button type="button" className="ui-control library-empty-action" onClick={onClearFilters}>Clear filters</button>
        </> : null}
      </div>
    </section>
  );
}
