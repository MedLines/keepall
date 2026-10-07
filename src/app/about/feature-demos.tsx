"use client";

import Image from "next/image";
import { Tooltip } from "@base-ui/react/tooltip";
import { ScrollPanel } from "@/components/ui/scroll-panel";
import { ScrollTextarea } from "@/components/ui/scroll-textarea";
import { useCallback, useRef, useState } from "react";
import type { SavedArticle } from "@/domain/article";
import { ArticleContent } from "../article-content";
import { CaptureFileList } from "../capture-file-list";
import { PaletteSwatch, ScreenshotTextSection } from "../image-tool-results";
import { ItemMediaFrame } from "../item-media-frame";
import { NoteContent } from "../note-content";
import { NoteFormatControl } from "../note-format-control";
import { ArrowRightIcon, PdfIcon, NoteIcon, LogoIcon } from "../shell-icons";
import { SamplePdf } from "./bento-pdf-demo";
import "./feature-demos.css";

export { PreviewDemo } from "./bento-preview-demo";

const sampleNote = "# A slower Sunday\n\nBring a **favorite book**.\n\nLeave the afternoon open.";
const sampleArticle: SavedArticle = {
  title: "A little room to think", sourceUrl: "https://sunday-studio.example/reading-room", capturedAt: 0,
  text: "A book by the window. Time to think.",
  content: [
    { tag: "h2", children: [{ text: "A little room to think" }] },
    { tag: "p", children: [{ text: "A book by the window. A quiet afternoon. Sometimes, a little space is all you need." }] },
  ],
};

function useDemoPortal() {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (node) setContainer(node.closest<HTMLElement>(".ka-about"));
  }, []);
  return [container, ref] as const;
}

export function ReadingDemo() {
  const [portalContainer, attachDemo] = useDemoPortal();
  const [kind, setKind] = useState<"article" | "pdf">("article");
  return <div className="kd-demo kd-reading" ref={attachDemo} data-feature-demo="reading">
    <div className="kd-reading-content squircle-panel" key={kind}>
      {kind === "article" ? <ScrollPanel className="kd-article-scroll" viewportProps={{ tabIndex: 0, "aria-label": "Sample saved article" }}>
        <Image className="kd-reading-photo" src="/marketing/reading-corner.webp" width={720} height={480} alt="Sunlight falling across a chair and books by the window" sizes="(max-width: 700px) 90vw, 680px" />
        <div className="kd-article-copy"><span className="kd-source-label">SUNDAY STUDIO · SAVED ARTICLE</span><ArticleContent article={sampleArticle} /></div>
      </ScrollPanel> : <SamplePdf portalContainer={portalContainer} />}
    </div>
    <div className="kd-reading-actions"><span><PdfIcon /> field-notes.pdf</span><button type="button" className="ka-button ka-button-small kd-button" onClick={() => setKind(value => value === "article" ? "pdf" : "article")}>{kind === "article" ? "Open PDF" : "Back to article"}<ArrowRightIcon /></button></div>
  </div>;
}

export function NotesDemo() {
  const [editing, setEditing] = useState(false);
  const [format, setFormat] = useState<"plain" | "markdown">("markdown");
  const [content, setContent] = useState(sampleNote);
  return <div className="kd-demo kd-notes squircle-panel" data-feature-demo="notes">
    <div className="kd-note-heading"><span><NoteIcon /> sunday.md</span><button type="button" className="ka-button ka-button-small kd-button" onClick={() => setEditing(value => !value)}>{editing ? "Preview" : "Edit"}</button></div>
    <div className="kd-note-format"><NoteFormatControl format={format} onChange={value => { setFormat(value); setEditing(false); }} /></div>
    {editing ? <ScrollTextarea className="kd-note-editor" autoFocus aria-label="Edit sample note" value={content} onChange={event => setContent(event.target.value)} spellCheck={false} />
      : <ScrollPanel className="kd-note-body" viewportProps={{ tabIndex: 0, "aria-label": "Sample note content" }}><NoteContent content={content} format={format} allowLocalImages={false} /></ScrollPanel>}
  </div>;
}

const sampleText = { text: "FIELD NOTES\nMake room to think.\nLeave the afternoon open.", confidence: 95, language: "eng" as const, extractedAt: 0 };
// Exact authored fills from icon.svg, converted with src/color-format.mjs.
const sampleColors = ["#FFF4F5", "#FFB0BC", "#FF4A6B"];

export function ImageToolsDemo() {
  const [portalContainer, attachDemo] = useDemoPortal();
  const [showText, setShowText] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  async function copy(value: string, key: string) {
    try { await navigator.clipboard.writeText(value); setCopied(key); setStatus(key === "ocr" ? "Text copied." : `${value} copied.`); }
    catch { setCopied(null); setStatus(`Select and copy: ${value}`); }
  }
  return <div className="kd-demo kd-image-tools" ref={attachDemo} data-feature-demo="image-tools">
    <ScrollPanel className="kd-image-stage" contentClassName="kd-image-stage-content" viewportProps={{ tabIndex: 0, "aria-label": "Sample image tools" }}>
      {showText ? <div className="kd-image-text"><Image className="kd-ocr-source" src="/marketing/demos/field-notes.svg" width={240} height={72} alt="Field notes. Make room to think. Leave the afternoon open." unoptimized /><p className="kd-caption">field-notes.svg · English text</p><ScreenshotTextSection ocr={sampleText} slide={0} copied={copied === "ocr"} onCopy={(value, key) => void copy(value, key)} /></div>
        : <><div className="kd-logo-source" role="img" aria-label="Keepall logo"><LogoIcon className="kd-palette-logo" /></div><p className="kd-caption kd-palette-label">Keepall logo colors</p>
          <Tooltip.Provider delay={250}><ul className="kd-swatches" aria-label="Keepall logo colors">{sampleColors.map(hex => <li key={hex}><PaletteSwatch hex={hex} copied={copied === hex} onCopy={() => void copy(hex, hex)} allowLibrarySearch={false} portalContainer={portalContainer} /></li>)}</ul></Tooltip.Provider></>}
    </ScrollPanel>
    <div className="kd-image-actions"><span className="kd-caption">{showText ? "Image text" : "Pick a color"}</span><button type="button" className="ka-button ka-button-small kd-button" onClick={() => setShowText(value => !value)}>{showText ? "Back to logo" : "Show text"}<ArrowRightIcon /></button></div>
    <span className="kd-live" role="status">{status}</span>
  </div>;
}

export function VideoDemo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");
  async function play() {
    try { await videoRef.current?.play(); setStarted(true); setError(""); }
    catch { setError("Playback unavailable. Try again."); }
  }
  return <div className="kd-demo kd-video" data-feature-demo="video">
    <ItemMediaFrame className="kd-media"><video ref={videoRef} aria-label="Sample afternoon light video" controls={started} playsInline preload="none" poster="/marketing/architecture.webp" width={640} height={360} src="/marketing/demos/afternoon-light.mp4" />
      {!started && <button type="button" className="kd-play" aria-label="Play sample video" onClick={() => void play()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 10 7-10 7Z" fill="currentColor" /></svg></button>}
    </ItemMediaFrame><span className="kd-live" role="status">{error}</span>
  </div>;
}

function sampleFiles() {
  return [new File([sampleNote], "weekend-notes.md", { type: "text/markdown" }), new File(["A book by the window."], "reading-room.txt", { type: "text/plain" })];
}

export function ImportDemo() {
  const [files, setFiles] = useState<File[]>(sampleFiles);
  const [status, setStatus] = useState("");
  return <div className="kd-demo kd-import" data-feature-demo="import">
    <ScrollPanel className="kd-file-list squircle-panel" viewportClassName="kd-file-viewport" viewportProps={{ tabIndex: 0, "aria-label": "Sample file queue" }}>{files.length ? <CaptureFileList files={files} results={[]} disabled={false} onRemove={index => { setFiles(current => current.filter((_, fileIndex) => fileIndex !== index)); setStatus("Sample file removed."); }} />
      : <p className="kd-import-empty">The queue is clear. Reset to try again.</p>}</ScrollPanel>
    <button type="button" className="ka-button ka-button-small kd-button kd-import-reset" onClick={() => { setFiles(sampleFiles()); setStatus("Sample queue reset."); }}>Reset sample files <ArrowRightIcon /></button>
    <span className="kd-live" role="status">{status}</span>
  </div>;
}
