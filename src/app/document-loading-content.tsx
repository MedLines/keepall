"use client";

import { PdfViewerControls } from "./pdf-viewer-controls";

export function PdfLoadingPaper() {
  return <div role="status" aria-label="Loading PDF" className="pdf-loading-paper">
    <span className="sr-only">Loading PDF…</span>
  </div>;
}

export function PdfViewerLoading() {
  return <section aria-label="PDF viewer" className="media-viewer-frame grid gap-4"><PdfViewerControls /><PdfLoadingPaper /></section>;
}

export function TextDocumentLoading({ compact = false }: { compact?: boolean }) {
  return <div role="status" aria-label={compact ? "Loading preview" : "Loading document"} className={compact ? "reading-preview-loading" : "document-reading-loading"}>
    <span className="sr-only">{compact ? "Loading preview…" : "Loading document…"}</span>
    <div aria-hidden="true" className="document-loading-lines">{Array.from({ length: compact ? 4 : 8 }, (_, index) => <span key={index} />)}</div>
  </div>;
}
