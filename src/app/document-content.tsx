"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { DocumentItem } from "@/domain/document";
import { NoteContent } from "./note-content";
import { useDocumentText } from "./use-document-text";
import { PdfViewerControls } from "./pdf-viewer-controls";

// Bound Markdown's DOM size; the original download always includes the entire file.
const PREVIEW_CHARACTERS = 200_000;
const PdfViewer = dynamic(() => import("./pdf-viewer").then(module => module.PdfViewer), { ssr: false, loading: () => <div className="media-viewer-frame grid gap-4"><PdfViewerControls /><p role="status" className="text-text-secondary">Loading PDF…</p></div> });

export function DocumentText({ text, format }: { text: string; format: DocumentItem["format"] }) {
  const limited = text.length > PREVIEW_CHARACTERS;
  const preview = limited ? text.slice(0, PREVIEW_CHARACTERS) : text;
  return <>
    {limited ? <p role="status" className="mb-5 rounded-input border border-border-control bg-bg-control px-4 py-3 text-sm text-text-secondary">Showing the first 200,000 characters. Download the file to read the entire file.</p> : null}
    {preview ? <NoteContent content={preview} format={format === "markdown" ? "markdown" : "plain"} headingStart={2} allowLocalImages={false} />
      : <p className="text-text-secondary">This file is empty.</p>}
  </>;
}

export function DocumentContent({ item, initialPreview }: { item: DocumentItem; initialPreview?: { text?: string; pdfImage?: string } }) {
  return item.format === "pdf" ? <PdfDocumentContent key={`${item.id}:${item.assetId}`} item={item} preview={initialPreview?.pdfImage} /> : <TextDocumentContent item={item} initialText={initialPreview?.text} />;
}

function PdfDocumentContent({ item, preview }: { item: DocumentItem; preview?: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"preview" | "revealing" | "ready">("preview");
  useEffect(() => {
    const node = frame.current;
    if (!preview || !node) return;
    let cancelled = false;
    const reveal = async () => {
      // Wait for the browser's opening snapshot to finish before sharpening it.
      if (typeof document.getAnimations === "function") {
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const name = `item-document-${item.id}-${item.assetId}`;
        const animations = document.getAnimations().filter(animation =>
          animation.effect instanceof KeyframeEffect && animation.effect.pseudoElement?.includes(name));
        await Promise.allSettled(animations.map(animation => animation.finished));
      }
      if (!cancelled) setPhase("revealing");
    };
    const observe = () => {
      if (!node.querySelector('[data-pdf-ready="1"], [role="alert"]')) return;
      observer.disconnect();
      if (node.querySelector('[role="alert"]')) setPhase("ready");
      else void reveal();
    };
    const observer = new MutationObserver(observe);
    observer.observe(node, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-pdf-ready"] });
    observe();
    return () => { cancelled = true; observer.disconnect(); };
  }, [preview, item.id, item.assetId]);
  if (!preview) return <PdfViewer item={item} />;
  return <div ref={frame} data-document-pdf-shell className="media-viewer-frame relative">
    {phase !== "ready" ? <div className="grid gap-4" data-pdf-opening-preview aria-hidden={phase === "revealing"}>
      <PdfViewerControls />
      {/* eslint-disable-next-line @next/next/no-img-element -- reuse the decoded local first-page thumbnail */}
      <img src={preview} alt={`First page of ${item.title || item.sourceFileName}`} className="media-outline block h-auto w-full rounded-input bg-white" />
    </div> : null}
    <div inert={phase === "preview"} className={phase === "ready" ? "" : `absolute inset-x-0 top-0 ${phase === "preview" ? "invisible" : "pdf-preview-reveal"}`}
      onAnimationEnd={event => {
        if (event.target === event.currentTarget && event.animationName === "pdf-preview-reveal") setPhase("ready");
      }}><PdfViewer item={item} /></div>
  </div>;
}

function TextDocumentContent({ item, initialText }: { item: DocumentItem; initialText?: string }) {
  const { state, retry } = useDocumentText(item);
  if (state.status === "loading") return initialText !== undefined ? <DocumentText text={initialText} format={item.format} /> : <p role="status" className="text-text-secondary">Loading document…</p>;
  if (state.status === "ready") return <DocumentText text={state.text} format={item.format} />;
  return <div className="grid justify-items-start gap-3">
    <p role="alert">{state.status === "missing" ? "The saved file is missing. Restore it from a backup." : "Couldn't read this document. Try again or restore a backup."}</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="ui-control min-h-11 px-4 text-sm font-medium" onClick={retry}>Retry document</button>
      <Link href="/settings#storage" className="ui-control inline-flex min-h-11 items-center px-4 text-sm font-medium">Open backups</Link>
    </div>
  </div>;
}
