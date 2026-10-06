"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import type { DocumentItem } from "@/domain/document";
import { NoteContent } from "./note-content";
import { useDocumentText } from "./use-document-text";

// Bound Markdown's DOM size; the original download always includes the entire file.
const PREVIEW_CHARACTERS = 200_000;
const PdfViewer = dynamic(() => import("./pdf-viewer").then(module => module.PdfViewer), { ssr: false, loading: () => <p role="status" className="text-text-secondary">Loading PDF…</p> });

export function DocumentText({ text, format }: { text: string; format: DocumentItem["format"] }) {
  const limited = text.length > PREVIEW_CHARACTERS;
  const preview = limited ? text.slice(0, PREVIEW_CHARACTERS) : text;
  return <>
    {limited ? <p role="status" className="mb-5 rounded-input border border-border-control bg-bg-control px-4 py-3 text-sm text-text-secondary">Showing the first 200,000 characters. Download the file to read the entire file.</p> : null}
    {preview ? <NoteContent content={preview} format={format === "markdown" ? "markdown" : "plain"} headingStart={2} allowLocalImages={false} />
      : <p className="text-text-secondary">This file is empty.</p>}
  </>;
}

export function DocumentContent({ item }: { item: DocumentItem }) {
  return item.format === "pdf" ? <PdfViewer key={`${item.id}:${item.assetId}`} item={item} /> : <TextDocumentContent item={item} />;
}

function TextDocumentContent({ item }: { item: DocumentItem }) {
  const { state, retry } = useDocumentText(item);
  if (state.status === "loading") return <p role="status" className="text-text-secondary">Loading document…</p>;
  if (state.status === "ready") return <DocumentText text={state.text} format={item.format} />;
  return <div className="grid justify-items-start gap-3">
    <p role="alert">{state.status === "missing" ? "The saved file is missing. Restore it from a backup." : "Couldn't read this document. Try again or restore a backup."}</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="ui-control min-h-11 px-4 text-sm font-medium" onClick={retry}>Retry document</button>
      <Link href="/settings#storage" className="ui-control inline-flex min-h-11 items-center px-4 text-sm font-medium">Open backups</Link>
    </div>
  </div>;
}
