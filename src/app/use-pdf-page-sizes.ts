"use client";

import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

export type PdfPageSize = { width: number; height: number };
type Layout = { status: "ready"; sizes: PdfPageSize[] } | { status: "error" };

/** Read lightweight page geometry once, before reserving space for the scroll view. */
export function usePdfPageSizes(document: PDFDocumentProxy) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ document: PDFDocumentProxy; attempt: number; layout: Layout } | null>(null);
  useEffect(() => {
    let active = true;
    let next = 1;
    const sizes: PdfPageSize[] = [];
    void Promise.all(Array.from({ length: Math.min(8, document.numPages) }, async () => {
      while (active && next <= document.numPages) {
        const number = next++;
        const page = await document.getPage(number);
        const viewport = page.getViewport({ scale: 1 });
        sizes[number - 1] = { width: viewport.width, height: viewport.height };
        page.cleanup();
      }
    })).then(() => { if (active) setResult({ document, attempt, layout: { status: "ready", sizes } }); })
      .catch(() => { if (active) { active = false; setResult({ document, attempt, layout: { status: "error" } }); } });
    return () => { active = false; };
  }, [document, attempt]);
  return {
    layout: result?.document === document && result.attempt === attempt ? result.layout : { status: "loading" as const },
    retry: () => setAttempt(value => value + 1),
  };
}
