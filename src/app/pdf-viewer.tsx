"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { DocumentItem } from "@/domain/document";
import { ArrowLeftIcon, ArrowRightIcon } from "./shell-icons";
import { PdfPage } from "./pdf-page";
import { usePdfDocument } from "./use-pdf-document";
import { PdfScroll, type PdfScrollHandle } from "./pdf-scroll";
import { SegmentedControl } from "./segmented-control";
import { usePdfPageSizes } from "./use-pdf-page-sizes";
import { ShellTopMenu } from "./shell-top-menu";
import { MediaViewerToolbar } from "./media-viewer-toolbar";

const BUTTON = "ui-control inline-flex size-11 shrink-0 items-center justify-center disabled:opacity-40";

export function PdfViewer({ item }: { item: DocumentItem }) {
  const { state, retry } = usePdfDocument(item);
  if (state.status === "loading") return <p role="status" className="text-text-secondary">Loading PDF…</p>;
  if (state.status === "error") return <div className="grid justify-items-start gap-3">
    <p role="alert">{state.message}</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="ui-control min-h-11 px-4 text-sm font-medium" onClick={retry}>Retry document</button>
      <Link href="/settings#storage" className="ui-control inline-flex min-h-11 items-center px-4 text-sm font-medium">Open backups</Link>
    </div>
  </div>;
  return <LoadedPdf key={state.key} document={state.document} noText={state.noText} />;
}

function LoadedPdf({ document, noText }: { document: PDFDocumentProxy; noText: boolean }) {
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState("fit");
  const [view, setView] = useState<"scroll" | "pages">("scroll");
  const scroll = useRef<PdfScrollHandle>(null);
  const pageFrame = useRef<HTMLDivElement>(null);
  const { layout, retry } = usePdfPageSizes(document);
  const [pageDraft, setPageDraft] = useState<string | null>(null);
  const pageText = pageDraft ?? String(page);
  function goToPage(number: number) {
    setPageDraft(null);
    setPage(number);
    scroll.current?.goToPage(number);
  }
  function jumpToPage() {
    const number = Number(pageText);
    const edited = pageDraft !== null;
    setPageDraft(null);
    if (edited && Number.isInteger(number) && pageText.trim()) goToPage(Math.max(1, Math.min(document.numPages, number)));
  }
  useLayoutEffect(() => {
    const frame = pageFrame.current;
    const main = frame?.closest<HTMLElement>("[data-document-scroll]");
    const toolbar = main?.querySelector<HTMLElement>("[data-pdf-toolbar]");
    if (!frame || !main || !toolbar) return;
    const gap = Number.parseFloat(getComputedStyle(frame.parentElement!).rowGap) || 0;
    const inset = toolbar.getBoundingClientRect().height + (Number.parseFloat(getComputedStyle(toolbar).top) || 0) + gap;
    main.scrollTo({ top: frame.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - inset, behavior: "instant" });
  }, [page, view]);
  return <section aria-label="PDF viewer" className="media-viewer-frame grid min-w-0 shrink-0 gap-4">
    <MediaViewerToolbar pdf view={<SegmentedControl label="PDF view" value={view} onChange={setView} className="w-40" choices={[{ value: "pages", label: "Pages" }, { value: "scroll", label: "Scroll" }]} />}
      navigation={<div className="flex items-center gap-2">
        <button type="button" className={BUTTON} aria-label="Previous page" disabled={page === 1} onClick={() => goToPage(page - 1)}><ArrowLeftIcon className="size-4" /></button>
        <label className="flex items-center gap-1.5 text-sm tabular-nums">Page
          <input aria-label="PDF page number" inputMode="numeric" className="ui-field h-11 w-14 px-1 text-center text-sm tabular-nums" value={pageText}
            onFocus={() => setPageDraft(String(page))}
            onChange={event => setPageDraft(event.target.value)} onBlur={jumpToPage}
            onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); jumpToPage(); } }} />
          <span>of {document.numPages}</span>
        </label>
        <span className="sr-only" role="status">Page {page} of {document.numPages}</span>
        <button type="button" className={BUTTON} aria-label="Next page" disabled={page === document.numPages} onClick={() => goToPage(page + 1)}><ArrowRightIcon className="size-4" /></button>
      </div>}
      zoom={<div className="flex items-center gap-2 text-sm text-text-secondary"><span className="sr-only">Zoom</span>
        <ShellTopMenu ariaLabel="PDF zoom" value={zoom} onChange={setZoom} className="h-11 gap-3 text-text-primary"
          options={[{ value: "fit", label: "Fit width" }, { value: "0.75", label: "75%" }, { value: "1", label: "100%" }, { value: "1.5", label: "150%" }, { value: "2", label: "200%" }]} />
      </div>} />
    {noText ? <p className="rounded-input border border-border-control bg-bg-raised p-3 text-sm text-text-secondary">This PDF has no selectable text. Search can find its title, filename, tags, and your notes. Text in scanned pages needs OCR.</p> : null}
    {view === "pages" ? <div ref={pageFrame} className="min-w-0"><PdfPage document={document} number={page} zoom={zoom} /></div>
      : layout.status === "ready" ? <PdfScroll key={zoom} document={document} sizes={layout.sizes} zoom={zoom} startPage={page} onPageChange={setPage} ref={scroll} />
      : layout.status === "error" ? <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">Couldn&apos;t prepare the scroll view. Try again or use Pages.<button type="button" className="ui-control min-h-10 px-3" onClick={retry}>Retry scroll view</button></div>
      : <p className="text-sm text-text-secondary">Preparing PDF pages…</p>}
  </section>;
}
