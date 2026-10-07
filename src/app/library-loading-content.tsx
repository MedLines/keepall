"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { LibraryLayout, LibraryListColumns } from "@/domain/library-view";
import { uiMotion } from "@/components/ui/motion-tokens";
import { LibraryFolderArtwork } from "./library-collections";
import { ItemPageHeader } from "./item-page-header";
import { ITEM_PAGE_GRID } from "./item-page-styles";

type LoadingProps = {
  layout: LibraryLayout;
  columns?: LibraryListColumns;
  kind?: "items" | "collections" | "tags";
  exiting?: boolean;
};

function LoadingCopy() {
  return <span className="library-loading-copy"><span /><span /></span>;
}

function LoadingPlaceholder({ kind, layout }: { kind: NonNullable<LoadingProps["kind"]>; layout: LibraryLayout }) {
  if (kind === "items") return layout === "list"
    ? <div className="library-loading-row"><span className="library-loading-thumbnail" /><LoadingCopy /></div>
    : <div className="library-loading-card"><span className="library-loading-media" /><LoadingCopy /></div>;
  return <div data-kind={kind} className="organization-card library-card library-loading-organization">
    <div className={`collection-folder ${kind === "tags" ? "library-card library-tag-card" : ""}`}>
      {kind === "collections" ? <LibraryFolderArtwork previews={[]} itemTypes={[]} />
        : <span className="library-card-media library-tag-stage"><span className="library-tag-previews" data-count="3"><span className="library-tag-preview" /><span className="library-tag-preview" /><span className="library-tag-preview" /></span></span>}
      <LoadingCopy />
    </div>
  </div>;
}

export function LibraryLoadingContent({ layout, columns = "auto", kind = "items", exiting = false }: LoadingProps) {
  const organization = kind !== "items";
  const label = kind === "items" ? "library" : kind;
  return <div role={exiting ? undefined : "status"} aria-label={exiting ? undefined : `Loading ${label}`}
    aria-hidden={exiting || undefined} className="library-loading-content" data-loading-kind={kind}>
    {!exiting ? <span className="sr-only">Loading {label}…</span> : null}
    <div aria-hidden="true" className={`library-loading-placeholders ${organization
      ? `collection-folder-grid ${kind === "tags" ? "library-tag-grid" : ""} ${layout === "list" ? "organization-list" : ""}`
      : layout === "list" ? "library-loading-list" : "library-loading-grid"}`}
      style={!organization && layout === "list" && columns !== "auto" ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
      {Array.from({ length: 12 }, (_, index) => <LoadingPlaceholder key={index} kind={kind} layout={layout} />)}
    </div>
  </div>;
}

export function LibraryStartupContent({ children, loading, placeholder, ...skeleton }: LoadingProps & { children: ReactNode; loading: boolean; placeholder?: ReactNode }) {
  const [shownSkeleton, setShownSkeleton] = useState(false);
  const [finished, setFinished] = useState(!loading);
  const startedAt = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (loading) {
      startedAt.current ??= performance.now();
      const timer = window.setTimeout(() => setShownSkeleton(true), 150);
      return () => window.clearTimeout(timer);
    }
    if (finished) return;
    const displayed = shownSkeleton || (startedAt.current !== null && performance.now() - startedAt.current >= 150);
    if (displayed) setShownSkeleton(true);
    const timer = window.setTimeout(() => setFinished(true), displayed ? uiMotion.moderate.duration * 1000 : 0);
    return () => window.clearTimeout(timer);
  }, [loading, shownSkeleton, finished]);
  const handoff = !loading && shownSkeleton && !finished;
  return <div className="library-startup-boundary" data-phase={loading ? "loading" : handoff ? "handoff" : "ready"}>
    {loading || handoff ? <div className="library-startup-placeholder" aria-hidden={handoff || undefined}>{placeholder ?? <LibraryLoadingContent {...skeleton} exiting={handoff} />}</div> : null}
    {!loading ? <div className={handoff ? "library-startup-content" : undefined}>{children}</div> : null}
  </div>;
}

export function ItemPageLoading({ returnHref = "/" }: { returnHref?: string }) {
  return <div className="flex h-dvh min-h-0 flex-col bg-bg-canvas">
    <ItemPageHeader returnHref={returnHref} title="Loading item…" />
    <main role="status" aria-label="Loading item" className="library-loading-content min-h-0 flex-1 overflow-hidden">
      <span className="sr-only">Loading item…</span>
      <div aria-hidden="true" className={`library-loading-placeholders ${ITEM_PAGE_GRID}`}>
        <div className="item-loading-media" />
        <div className="item-loading-details"><span /><span /><span /></div>
      </div>
    </main>
  </div>;
}
