"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "./shell-icons";
import { SegmentedControl } from "./segmented-control";
import { ShellTopMenu } from "./shell-top-menu";
import { MediaViewerToolbar } from "./media-viewer-toolbar";

const BUTTON = "ui-control inline-flex size-11 shrink-0 items-center justify-center disabled:opacity-40";

export function PdfViewerControls({ view = "scroll", page = 1, pageText, pageCount, zoom = "fit", onViewChange, onZoomChange, onPreviousPage, onNextPage, onPageFocus, onPageDraftChange, onPageCommit }: {
  view?: "scroll" | "pages"; page?: number; pageText?: string; pageCount?: number; zoom?: string;
  onViewChange?: (view: "scroll" | "pages") => void; onZoomChange?: (zoom: string) => void;
  onPreviousPage?: () => void; onNextPage?: () => void; onPageFocus?: () => void;
  onPageDraftChange?: (value: string) => void; onPageCommit?: () => void;
}) {
  const loading = pageCount === undefined;
  return <MediaViewerToolbar pdf
    view={<SegmentedControl label="PDF view" value={view} onChange={value => onViewChange?.(value)} disabled={loading} className="w-40" choices={[{ value: "pages", label: "Pages" }, { value: "scroll", label: "Scroll" }]} />}
    navigation={<div className="flex items-center gap-2">
      <button type="button" className={BUTTON} aria-label="Previous page" disabled={loading || page === 1} onClick={onPreviousPage}><ArrowLeftIcon className="size-4" /></button>
      <label className="flex items-center gap-1.5 text-sm tabular-nums">Page
        <input aria-label="PDF page number" inputMode="numeric" disabled={loading} className="ui-field h-11 w-14 px-1 text-center text-sm tabular-nums" value={pageText ?? String(page)}
          onFocus={onPageFocus} onChange={event => onPageDraftChange?.(event.target.value)} onBlur={onPageCommit}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); onPageCommit?.(); } }} />
        <span>of <span className="inline-block min-w-[4ch]">{pageCount ?? "…"}</span></span>
      </label>
      <span className="sr-only" role="status">{loading ? "Preparing PDF viewer…" : `Page ${page} of ${pageCount}`}</span>
      <button type="button" className={BUTTON} aria-label="Next page" disabled={loading || page === pageCount} onClick={onNextPage}><ArrowRightIcon className="size-4" /></button>
    </div>}
    zoom={<div className="flex items-center gap-2 text-sm text-text-secondary"><span className="sr-only">Zoom</span>
      <ShellTopMenu ariaLabel="PDF zoom" value={zoom} onChange={value => onZoomChange?.(value)} disabled={loading} className="h-11 gap-3 text-text-primary"
        options={[{ value: "fit", label: "Fit width" }, { value: "0.75", label: "75%" }, { value: "1", label: "100%" }, { value: "1.5", label: "150%" }, { value: "2", label: "200%" }]} />
    </div>}
  />;
}
