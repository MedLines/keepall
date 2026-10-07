"use client";

import Link from "next/link";
import { openCaptureDialog } from "./capture-events";

export type LibraryEmptyStateKind = "library" | "collection" | "unsorted" | "trash" | "filtered";

type Props = {
  kind: LibraryEmptyStateKind;
  message: string;
  onClearFilters: () => void;
};

export function LibraryEmptyState({ kind, message, onClearFilters }: Props) {
  return (
    <section className="max-w-xl py-1">
      <p className="text-sm text-text-secondary">{message}</p>
      {kind === "library" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="ui-control ui-primary h-10 px-4 text-sm font-medium" onClick={openCaptureDialog}>
            Save your first item
          </button>
          <Link className="ui-control inline-flex min-h-10 items-center px-4 text-sm" href="/settings#backup-heading">Import an existing library</Link>
          <Link className="inline-flex min-h-10 items-center px-2 text-sm text-text-secondary underline underline-offset-4" href="/help/getting-started">Getting started</Link>
        </div>
      ) : null}
      {kind === "collection" || kind === "unsorted" ? (
        <div className="mt-4">
          <button type="button" className="ui-control ui-primary h-10 px-4 text-sm font-medium" onClick={openCaptureDialog}>
            Save an item
          </button>
        </div>
      ) : null}
      {kind === "trash" ? (
        <p className="mt-2 max-w-prose text-sm text-text-secondary">Deleted items appear here until you restore them or empty the trash.</p>
      ) : null}
      {kind === "filtered" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
          <span>Try changing or clearing the active filters.</span>
          <button type="button" className="rounded-control px-2.5 py-1.5 font-medium text-text-primary underline-offset-4 hover:underline" onClick={onClearFilters}>
            Clear filters
          </button>
        </div>
      ) : null}
    </section>
  );
}
