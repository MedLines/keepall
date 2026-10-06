"use client";

import { useEffect, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import type { DocumentItem } from "@/domain/document";
import { getDocumentOriginal } from "@/persistence/documents";
import { openPdf, pdfErrorMessage } from "@/persistence/pdf-document";

type State = { key: string } & (
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; document: PDFDocumentProxy; noText: boolean }
);

export function usePdfDocument(item: DocumentItem) {
  const [attempt, setAttempt] = useState(0);
  const key = `${item.id}:${item.assetId}:${attempt}`;
  const [state, setState] = useState<State>({ key: "", status: "loading" });
  useEffect(() => {
    let active = true;
    let task: PDFDocumentLoadingTask | undefined;
    void getDocumentOriginal(item.id).then(async original => {
      if (!active) return;
      if (!original || original.id !== item.assetId) {
        setState({ key, status: "error", message: "The saved file is missing. Restore it from a backup." });
        return;
      }
      task = await openPdf(original.bytes);
      if (!active) { await task.destroy(); return; }
      const document = await task.promise;
      if (active) setState({ key, status: "ready", document, noText: original.pdfText === "" });
    }).catch(error => {
      if (active) setState({ key, status: "error", message: pdfErrorMessage(error) });
    });
    return () => { active = false; void task?.destroy().catch(() => {}); };
  }, [item.id, item.assetId, key]);
  return {
    state: state.key === key ? state : { key, status: "loading" as const },
    retry: () => setAttempt(value => value + 1),
  };
}
