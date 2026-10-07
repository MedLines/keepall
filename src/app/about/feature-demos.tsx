"use client";

import Image from "next/image";
import { Tooltip } from "@base-ui/react/tooltip";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import type { SavedArticle } from "@/domain/article";
import type { NoteItem } from "@/domain/note";
import { ArticleContent } from "../article-content";
import { CaptureFileList } from "../capture-file-list";
import { PaletteSection, ScreenshotTextSection } from "../image-tool-results";
import { ItemMediaFrame } from "../item-media-frame";
import { ItemTypeIcon } from "../item-type-icon";
import { NoteContent } from "../note-content";
import { NoteFormatControl } from "../note-format-control";
import { PdfScroll, type PdfScrollHandle } from "../pdf-scroll";
import { usePdfPageSizes } from "../use-pdf-page-sizes";
import { PdfViewerControls } from "../pdf-viewer-controls";
import { SegmentedControl } from "../segmented-control";
import { ArrowLeftIcon, ArrowRightIcon } from "../shell-icons";
import "./feature-demos.css";

const sampleNote = "# A slower Sunday\n\nBring a **favorite book**. Leave the afternoon open.";
const sampleArticle: SavedArticle = {
  title: "A little room to think",
  sourceUrl: "https://sunday-studio.example/reading-room",
  capturedAt: 0,
  text: "A quiet room changes an afternoon. Put a book by the window and leave a little space for ideas.",
  content: [
    { tag: "h2", children: [{ text: "A little room to think" }] },
    { tag: "p", children: [{ text: "A book by the window. Time to think." }] },
  ],
};
const noteItem: NoteItem = { id: "demo-note", type: "note", title: "A slower Sunday", content: sampleNote, format: "markdown", tagIds: [], collectionIds: [], createdAt: 0, updatedAt: 0 };

function useDemoPortal() {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (node) setContainer(node.closest<HTMLElement>(".ka-about"));
  }, []);
  return [container, ref] as const;
}

function SamplePdfPages({ document, page, zoom, view, onPageChange, scrollRef }: {
  document: PDFDocumentProxy; page: number; zoom: string; view: "pages" | "scroll";
  onPageChange: (page: number) => void; scrollRef: RefObject<PdfScrollHandle | null>;
}) {
  const { layout, retry } = usePdfPageSizes(document);
  return layout.status === "ready" ? <PdfScroll key={zoom} document={document} sizes={layout.sizes} zoom={zoom} view={view} startPage={page} onPageChange={onPageChange} ref={scrollRef} />
    : layout.status === "error" ? <button className="kd-button" type="button" onClick={retry}>Retry sample pages</button>
    : <p role="status">Preparing sample pages…</p>;
}

function SamplePdf({ portalContainer }: { portalContainer: HTMLElement | null }) {
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
    <div className="kd-pdf-pages" data-document-scroll tabIndex={0} aria-label="Sample PDF pages">
      {document ? <SamplePdfPages document={document} page={page} zoom={zoom} view={view} onPageChange={setPage} scrollRef={scrollRef} />
        : failed ? <p role="alert">Sample PDF unavailable. <button type="button" className="kd-button" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>Retry</button></p>
        : <p role="status">Loading sample PDF…</p>}
    </div>
  </div></Tooltip.Provider>;
}

export function ReadingDemo() {
  const [portalContainer, attachDemo] = useDemoPortal();
  const [kind, setKind] = useState<"article" | "pdf">("article");
  return <div className="kd-demo kd-reading" ref={attachDemo} data-feature-demo="reading">
    <div className="kd-toolbar"><SegmentedControl label="Sample reading format" value={kind} onChange={setKind} choices={[{ value: "article", label: "Article" }, { value: "pdf", label: "PDF" }]} /><span className="kd-caption">Sample reading copy</span></div>
    <div className="kd-reading-body" key={kind}>{kind === "article" ? <ArticleContent article={sampleArticle} /> : <SamplePdf portalContainer={portalContainer} />}</div>
  </div>;
}

export function NotesDemo() {
  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [format, setFormat] = useState<"plain" | "markdown">("markdown");
  const [content, setContent] = useState(sampleNote);
  return <div className="kd-demo kd-notes" data-feature-demo="notes">
    <div className="kd-toolbar"><SegmentedControl label="Sample note mode" value={mode} onChange={setMode} choices={[{ value: "edit", label: "Edit" }, { value: "preview", label: "Preview" }]} /><NoteFormatControl format={format} onChange={setFormat} /></div>
    <div className="kd-note-body" key={mode}>
      {mode === "edit" ? <textarea aria-label="Edit sample note" value={content} onChange={event => setContent(event.target.value)} spellCheck={false} />
        : <NoteContent content={content} format={format} allowLocalImages={false} />}
    </div>
    <p className="kd-caption">Try editing this sample note.</p>
  </div>;
}

const sampleText = { text: "FIELD NOTES\nMake room to think.\nLeave the afternoon open.", confidence: 95, language: "eng" as const, extractedAt: 0 };
const sampleColors = ["#F7F3E8", "#B34632", "#D6DEB8"];

export function ImageToolsDemo() {
  const [portalContainer, attachDemo] = useDemoPortal();
  const [tool, setTool] = useState<"palette" | "text">("palette");
  const [copied, setCopied] = useState<string | null>(null);
  const [status, setStatus] = useState("Copy a sample color.");
  async function copy(value: string, key: string) {
    try { await navigator.clipboard.writeText(value); setCopied(key); setStatus(key === "ocr" ? "Sample text copied." : `${value} copied.`); }
    catch { setCopied(null); setStatus(`Select and copy: ${value}`); }
  }
  return <div className="kd-demo kd-image-tools" ref={attachDemo} data-feature-demo="image-tools">
    <Image className="kd-sample-image" src="/marketing/demos/field-notes.svg" width={240} height={72} alt="Field notes. Make room to think. Leave the afternoon open." unoptimized />
    <SegmentedControl label="Sample image results" value={tool} onChange={value => { setTool(value); setStatus(value === "text" ? "English text from this image." : "Copy a sample color."); }} choices={[{ value: "palette", label: "Colors" }, { value: "text", label: "Show text" }]} />
    <div className="kd-image-result" key={tool}>
      {tool === "palette" ? <PaletteSection palette={sampleColors} copied={copied} onCopy={(value, key) => void copy(value, key)} allowLibrarySearch={false} portalContainer={portalContainer} />
        : <ScreenshotTextSection ocr={sampleText} slide={0} copied={copied === "ocr"} onCopy={(value, key) => void copy(value, key)} />}
    </div>
    <p className="kd-caption kd-copy-status" role="status">{status}</p>
  </div>;
}

export function VideoDemo() {
  return <div className="kd-demo kd-video" data-feature-demo="video">
    <ItemMediaFrame className="kd-media"><video aria-label="Play the sample afternoon light video" controls playsInline preload="metadata" poster="/marketing/architecture.webp" width={640} height={360} src="/marketing/demos/afternoon-light.mp4" /></ItemMediaFrame>
  </div>;
}

export function PreviewDemo() {
  const [index, setIndex] = useState(0);
  return <div className="kd-demo kd-preview" data-feature-demo="preview">
    <div className="kd-preview-content" key={index}>
      {index === 0 ? <div className="kd-preview-note"><ItemTypeIcon item={noteItem} /><NoteContent content={"A book by the window.\nLeave the afternoon open."} format="plain" allowLocalImages={false} /></div>
        : <ItemMediaFrame className="kd-preview-media"><Image src="/marketing/reading-corner.webp" width={480} height={320} alt="A sunlit reading corner" sizes="(max-width: 700px) 80vw, 280px" /></ItemMediaFrame>}
    </div>
    <div className="kd-preview-controls"><button type="button" className="kd-button" aria-label="Previous sample preview" onClick={() => setIndex(value => (value + 1) % 2)}><ArrowLeftIcon /></button><span className="kd-caption" role="status">{index + 1} of 2 · {index === 0 ? "Note" : "Image"}</span><button type="button" className="kd-button" aria-label="Next sample preview" onClick={() => setIndex(value => (value + 1) % 2)}><ArrowRightIcon /></button></div>
  </div>;
}

function sampleFiles() {
  return [new File([sampleNote], "weekend-notes.md", { type: "text/markdown" }), new File(["A book by the window."], "reading-room.txt", { type: "text/plain" })];
}

export function ImportDemo() {
  const [files, setFiles] = useState<File[]>(sampleFiles);
  const [status, setStatus] = useState("");
  return <div className="kd-demo kd-import" data-feature-demo="import">
    <button type="button" className="kd-button kd-import-add" onClick={() => { setFiles(sampleFiles()); setStatus("Sample queue reset."); }}>Reset sample files</button>
    {files.length ? <CaptureFileList files={files} results={[]} disabled={false} onRemove={index => { setFiles(current => current.filter((_, fileIndex) => fileIndex !== index)); setStatus("Sample file removed."); }} />
      : <p className="kd-import-empty">Try a Markdown note and a text file. Remove either file from the queue.</p>}
    <p className="kd-caption" role="status">{status || "Sample files. Nothing saved."}</p>
  </div>;
}
