"use client";

import Image from "next/image";
import { Tooltip } from "@base-ui/react/tooltip";
import { useCallback, useRef, useState } from "react";
import type { SavedArticle } from "@/domain/article";
import { ArticleContent } from "../article-content";
import { CaptureFileList } from "../capture-file-list";
import { PaletteSwatch, ScreenshotTextSection } from "../image-tool-results";
import { ItemMediaFrame } from "../item-media-frame";
import { NoteContent } from "../note-content";
import { NoteFormatControl } from "../note-format-control";
import { ArrowLeftIcon, ArrowRightIcon, PdfIcon, NoteIcon } from "../shell-icons";
import { SamplePdf } from "./bento-pdf-demo";
import "./feature-demos.css";

const sampleNote = "# A slower Sunday\n\nBring a **favorite book**.\n\n- Make some coffee\n- Leave the afternoon open";
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
    <div className="kd-reading-paper" key={kind}>
      {kind === "article" ? <>
        <Image className="kd-reading-photo" src="/marketing/reading-corner.webp" width={720} height={480} alt="Sunlight falling across a chair and books by the window" sizes="(max-width: 700px) 90vw, 680px" />
        <div className="kd-article-copy"><span className="kd-paper-label">SUNDAY STUDIO · SAVED ARTICLE</span><ArticleContent article={sampleArticle} /></div>
      </> : <SamplePdf portalContainer={portalContainer} />}
    </div>
    <div className="kd-reading-actions"><span><PdfIcon /> field-notes.pdf</span><button type="button" className="kd-button" onClick={() => setKind(value => value === "article" ? "pdf" : "article")}>{kind === "article" ? "Open PDF" : "Back to article"}<ArrowRightIcon /></button></div>
  </div>;
}

export function NotesDemo() {
  const [editing, setEditing] = useState(false);
  const [format, setFormat] = useState<"plain" | "markdown">("markdown");
  const [content, setContent] = useState(sampleNote);
  return <div className="kd-demo kd-notes" data-feature-demo="notes">
    <div className="kd-note-heading"><span><NoteIcon /> sunday.md</span><button type="button" className="kd-button" onClick={() => setEditing(value => !value)}>{editing ? "Preview" : "Edit"}</button></div>
    {editing ? <div className="kd-note-editor"><NoteFormatControl format={format} onChange={setFormat} /><textarea aria-label="Edit sample note" value={content} onChange={event => setContent(event.target.value)} spellCheck={false} /></div>
      : <div className="kd-note-body"><NoteContent content={content} format={format} allowLocalImages={false} /></div>}
  </div>;
}

const sampleText = { text: "FIELD NOTES\nMake room to think.\nLeave the afternoon open.", confidence: 95, language: "eng" as const, extractedAt: 0 };
const sampleColors = ["#F7F3E8", "#B34632", "#D6DEB8"];

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
    {showText ? <div className="kd-image-text"><ScreenshotTextSection ocr={sampleText} slide={0} copied={copied === "ocr"} onCopy={(value, key) => void copy(value, key)} /></div>
      : <><Image className="kd-sample-image" src="/marketing/demos/field-notes.svg" width={240} height={72} alt="Field notes. Make room to think. Leave the afternoon open." unoptimized />
        <Tooltip.Provider delay={250}><ul className="kd-swatches" aria-label="Image colors">{sampleColors.map(hex => <li key={hex}><PaletteSwatch hex={hex} copied={copied === hex} onCopy={() => void copy(hex, hex)} allowLibrarySearch={false} portalContainer={portalContainer} /></li>)}</ul></Tooltip.Provider></>}
    <div className="kd-image-actions"><span className="kd-caption">{showText ? "From this image" : "Pick a color"}</span><button type="button" className="kd-button" onClick={() => setShowText(value => !value)}>{showText ? "Back to image" : "Show text"}<ArrowRightIcon /></button></div>
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

export function PreviewDemo() {
  const [index, setIndex] = useState(0);
  return <div className="kd-demo kd-preview" data-feature-demo="preview">
    <div className="kd-preview-stack"><div className="kd-preview-content" key={index}>
      {index === 0 ? <ItemMediaFrame className="kd-preview-media"><Image src="/marketing/reading-corner.webp" width={480} height={320} alt="A sunlit reading corner" sizes="(max-width: 700px) 80vw, 300px" /></ItemMediaFrame>
        : <div className="kd-preview-note"><NoteContent content={"# A little pause\n\nA book by the window.\n\nLeave the afternoon open."} format="markdown" allowLocalImages={false} /></div>}
    </div></div>
    <div className="kd-preview-controls"><button type="button" className="kd-button" aria-label="Previous sample preview" onClick={() => setIndex(value => (value + 1) % 2)}><ArrowLeftIcon /></button><span className="kd-caption" role="status">{index === 0 ? "reading-corner.webp" : "a-little-pause.md"}</span><button type="button" className="kd-button" aria-label="Next sample preview" onClick={() => setIndex(value => (value + 1) % 2)}><ArrowRightIcon /></button></div>
  </div>;
}

function sampleFiles() {
  return [new File([sampleNote], "weekend-notes.md", { type: "text/markdown" }), new File(["A book by the window."], "reading-room.txt", { type: "text/plain" })];
}

export function ImportDemo() {
  const [files, setFiles] = useState<File[]>(sampleFiles);
  const [status, setStatus] = useState("");
  return <div className="kd-demo kd-import" data-feature-demo="import">
    <div className="kd-file-paper">{files.length ? <CaptureFileList files={files} results={[]} disabled={false} onRemove={index => { setFiles(current => current.filter((_, fileIndex) => fileIndex !== index)); setStatus("Sample file removed."); }} />
      : <p className="kd-import-empty">The queue is clear. Reset to try again.</p>}</div>
    <button type="button" className="kd-button kd-import-reset" onClick={() => { setFiles(sampleFiles()); setStatus("Sample queue reset."); }}>Reset sample files <ArrowRightIcon /></button>
    <span className="kd-live" role="status">{status}</span>
  </div>;
}
