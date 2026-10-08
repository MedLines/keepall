"use client";

import { ScrollPanel } from "@/components/ui/scroll-panel";
import { Tooltip } from "@base-ui/react/tooltip";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import { PdfScroll, type PdfScrollHandle } from "../pdf-scroll";
import { usePdfPageSizes } from "../use-pdf-page-sizes";
import { PdfViewerControls } from "../pdf-viewer-controls";

function SamplePdfPages({ document, page, zoom, view, onPageChange, scrollRef }: {
  document: PDFDocumentProxy; page: number; zoom: string; view: "pages" | "scroll";
  onPageChange: (page: number) => void; scrollRef: RefObject<PdfScrollHandle | null>;
}) {
  const { layout, retry } = usePdfPageSizes(document);
  return layout.status === "ready" ? <PdfScroll key={zoom} document={document} sizes={layout.sizes} zoom={zoom} view={view} startPage={page} onPageChange={onPageChange} ref={scrollRef} />
    : layout.status === "error" ? <button className="ui-control kd-button" type="button" onClick={retry}>Retry sample pages</button>
    : <p role="status">Preparing sample pages…</p>;
}

export function SamplePdf({ portalContainer }: { portalContainer: HTMLElement | null }) {
  const scrollRef = useRef<PdfScrollHandle>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<string | null>(null);
  const [view, setView] = useState<"pages" | "scroll">("pages");
  const [zoom, setZoom] = useState("fit");
  useEffect(() => {
    let active = true;
    let task: PDFDocumentLoadingTask | undefined;
    const controller = new AbortController();
    void fetch("/marketing/demos/field-notes.pdf", { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Sample PDF unavailable");
        const bytes = new Uint8Array(await response.arrayBuffer());
        const { openPdf } = await import("@/persistence/pdf-document");
        if (!active) return;
        task = await openPdf(bytes);
        if (!active) { await task.destroy(); return; }
        const loaded = await task.promise;
        if (active) setDocument(loaded);
      }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; controller.abort(); void task?.destroy(); };
  }, [attempt]);
  function goToPage(number: number) { setDraft(null); setPage(number); scrollRef.current?.goToPage(number); }
  function commitPage() {
    const number = Number(draft);
    if (draft?.trim() && Number.isInteger(number)) goToPage(Math.max(1, Math.min(2, number)));
    else setDraft(null);
  }
  return <Tooltip.Provider><div className="kd-pdf">
    <PdfViewerControls portalContainer={portalContainer} view={view} page={page} pageText={draft ?? String(page)} pageCount={document?.numPages} zoom={zoom}
      onViewChange={setView} onZoomChange={setZoom} onPreviousPage={() => goToPage(page - 1)} onNextPage={() => goToPage(page + 1)}
      onPageFocus={() => setDraft(String(page))} onPageDraftChange={setDraft} onPageCommit={commitPage} />
    <ScrollPanel className="kd-pdf-pages" viewportClassName="kd-pdf-viewport" viewportProps={{ "data-document-scroll": true, tabIndex: 0, "aria-label": "Sample PDF pages" }}>
      {document ? <SamplePdfPages document={document} page={page} zoom={zoom} view={view} onPageChange={setPage} scrollRef={scrollRef} />
        : failed ? <p role="alert">Sample PDF unavailable. <button type="button" className="ui-control kd-button" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>Retry</button></p>
        : <p role="status">Loading sample PDF…</p>}
    </ScrollPanel>
  </div></Tooltip.Provider>;
}
