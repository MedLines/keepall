"use client";

import Link from "next/link";
import type { LibraryViewState } from "@/domain/library-view";
import { openBulkImportDialog, openCaptureDialog } from "./capture-events";
import { LibraryFolderArtwork } from "./library-collections";
import { SearchIcon, DeleteIcon } from "./shell-icons";
import "./library-empty-state.css";
import { buttonClassName } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useTranslations } from "@/i18n/use-translations";

export type LibraryEmptyStateKind = "library" | "collection" | "unsorted" | "trash" | "filtered" | "first-save";

export function getEmptyStateKind(view: LibraryViewState, hasActiveSearch: boolean, activeLibraryCount: number): LibraryEmptyStateKind {
  if (hasActiveSearch || view.type !== null || view.tag !== null) return "filtered";
  if (view.trash) return "trash";
  if (view.unsorted) return "unsorted";
  if (view.collection !== null) return "collection";
  return activeLibraryCount === 0 ? "first-save" : "library";
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
  const t = useTranslations("LibraryEmptyState");
  const firstSave = kind === "first-save";
  const canSave = firstSave || kind === "library" || kind === "collection" || kind === "unsorted";
  const description = t(firstSave ? "firstSave" : kind);
  const title = firstSave ? t("firstSaveTitle") : query?.trim() ? t("noResults", { query: query.trim() }) : message;
  return (
    <section className="library-empty-state">
      {canSave ? (
        <div className="library-empty-illustration" aria-hidden="true">
          <LibraryFolderArtwork previews={[]} itemTypes={[]} emptyState />
        </div>
      ) : (
        <div className="library-empty-symbol text-text-secondary" aria-hidden="true">
          {kind === "trash" ? <DeleteIcon className="size-5" /> : <SearchIcon className="size-5" />}
        </div>
      )}
      <h2 className="library-empty-title text-text-primary">{title}</h2>
      {query?.trim() && scope ? <p className="library-empty-scope text-text-secondary">{t("searching", { scope })}</p> : null}
      <p className="library-empty-description text-text-secondary">{description}</p>
      <div className="library-empty-actions">
        {canSave ? <button type="button" className={buttonClassName({ variant: "primary", size: "none", className: "inline-block library-empty-action" })} onClick={openCaptureDialog}>{firstSave ? t("saveFirstItem") : t("saveItem")}</button> : null}
        {firstSave ? <Tooltip content={t("importTooltip")}><button type="button" className={buttonClassName({ size: "none", className: "inline-block library-empty-action" })} onClick={openBulkImportDialog}>{t("importItems")}</button></Tooltip> : null}
        {kind === "filtered" ? <>
          {onSearchEntireLibrary ? <button type="button" className={buttonClassName({ variant: "primary", size: "none", className: "inline-block library-empty-action" })} onClick={onSearchEntireLibrary}>{t("searchEverywhere")}</button> : null}
          <button type="button" className={buttonClassName({ size: "none", className: "inline-block library-empty-action" })} onClick={onClearFilters}>{t("clearFilters")}</button>
        </> : null}
      </div>
      {firstSave ? <div className="mt-3 flex max-w-full flex-wrap items-center justify-center gap-x-4 text-xs text-text-secondary">
        <Link className="inline-flex min-h-10 items-center underline underline-offset-4" href="/settings#backup-heading">{t("importBackup")}</Link>
        <Link className="inline-flex min-h-10 items-center underline underline-offset-4" href="/help/getting-started">{t("gettingStarted")}</Link>
      </div> : null}
    </section>
  );
}
