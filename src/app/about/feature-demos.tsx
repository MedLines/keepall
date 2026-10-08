"use client";

import Image from "next/image";
import { Tooltip } from "@base-ui/react/tooltip";
import { ScrollPanel } from "@/components/ui/scroll-panel";
import { useCallback, useState } from "react";
import type { SavedArticle } from "@/domain/article";
import { ArticleContent } from "../article-content";
import { PaletteSwatch } from "../image-tool-results";
import { VideoPlayer } from "../video-player";
import { DemoNoteEditor } from "./demo-note-editor";
import { NoteContent } from "../note-content";
import { NoteFormatControl } from "../note-format-control";
import { PdfIcon, CopyIcon, CheckIcon, LogoIcon } from "../shell-icons";
import { SamplePdf } from "./bento-pdf-demo";
import "./feature-demos.css";

export { PreviewDemo } from "./bento-preview-demo";
export { ImportDemo } from "./bento-import-demo";

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
  return <div className="kd-demo kd-reading" data-feature-demo="reading">
    <div className="kd-reading-content">
      <ScrollPanel className="kd-article-scroll" viewportProps={{ tabIndex: 0, "aria-label": "Sample saved article" }}>
        <Image className="kd-reading-photo" src="/marketing/reading-corner.webp" width={720} height={480} alt="Sunlight falling across a chair and books by the window" sizes="(max-width: 700px) 90vw, 500px" />
        <div className="kd-article-copy"><span className="kd-source-label">SUNDAY STUDIO · SAVED ARTICLE</span><ArticleContent article={sampleArticle} /></div>
      </ScrollPanel>
    </div>
    <div className="kd-reading-actions"><span><CheckIcon /> Available offline</span><span>Sample article</span></div>
  </div>;
}

export function PdfDemo() {
  const [portalContainer, attachDemo] = useDemoPortal();
  return <div className="kd-demo kd-document" ref={attachDemo} data-feature-demo="pdf">
    <div className="kd-document-viewer"><SamplePdf portalContainer={portalContainer} /></div>
    <div className="kd-reading-actions"><span><PdfIcon /> field-notes.pdf</span><span>2 pages</span></div>
  </div>;
}

export function NotesDemo() {
  const [editing, setEditing] = useState(false);
  const [format, setFormat] = useState<"plain" | "markdown">("markdown");
  const [content, setContent] = useState(sampleNote);
  return <div className="kd-demo kd-notes squircle-panel" data-feature-demo="notes">
    <div className="kd-note-heading"><NoteFormatControl format={format} onChange={value => { setFormat(value); setEditing(false); }} /><button type="button" className="ui-control kd-button" onClick={() => setEditing(value => !value)}>{editing ? "Preview" : "Edit"}</button></div>
    {editing ? <DemoNoteEditor content={content} onChange={setContent} />
      : <ScrollPanel className="kd-note-body" viewportProps={{ tabIndex: 0, "aria-label": "Sample note content" }}><NoteContent content={content} format={format} allowLocalImages={false} /></ScrollPanel>}
  </div>;
}

const sampleText = "READING NOTES\nMake room to think.\nLeave the afternoon open.";
// Exact authored logo fills, converted from icon.svg.
const sampleColors = ["#FFF4F5", "#FFB0BC", "#FF4A6B"];

export function ImageToolsDemo() {
  const [portalContainer, attachDemo] = useDemoPortal();
  const [copied, setCopied] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  async function copy(value: string, key: string) {
    try { await navigator.clipboard.writeText(value); setCopied(key); setStatus(key === "ocr" ? "Text copied." : `${value} copied.`); }
    catch { setCopied(null); setStatus(`Select and copy: ${value}`); }
  }
  return <div className="kd-demo kd-image-tools" ref={attachDemo} data-feature-demo="image-tools">
    <div className="kd-image-workspace">
      <div className="kd-image-example kd-ocr-demo">
        <h4 className="kd-image-heading">Extract image text</h4>
        <div className="kd-ocr-body">
          <Image className="kd-ocr-source" src="/marketing/demos/reading-notes.svg" width={400} height={440} alt="Reading notes. Make room to think. Leave the afternoon open." unoptimized />
          <p className="kd-extracted-text" role="region" aria-label="Extracted text from image 1">{sampleText}</p>
        </div>
        <button className="ui-control kd-button" type="button" onClick={() => void copy(sampleText, "ocr")}><CopyIcon />{copied === "ocr" ? "Copied" : "Copy text"}</button>
      </div>
      <div className="kd-image-example kd-palette-result">
        <h4 className="kd-image-heading">Extract color palettes</h4>
        <div className="kd-palette-inset">
          <div className="kd-palette-source" role="img" aria-label="Keepall logo"><LogoIcon className="kd-palette-logo" /></div>
          <Tooltip.Provider delay={250}><ul className="kd-swatches" aria-label="Keepall logo colors">{sampleColors.map(hex => <li key={hex}><PaletteSwatch hex={hex} copied={copied === hex} onCopy={() => void copy(hex, hex)} allowLibrarySearch={false} portalContainer={portalContainer} /></li>)}</ul></Tooltip.Provider>
        </div>
      </div>
    </div>
    <span className="kd-live" role="status">{status}</span>
  </div>;
}

export function VideoDemo() {
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return <div className="kd-demo kd-video" data-feature-demo="video">
    <div className="kd-video-player"><VideoPlayer key={attempt} src="/marketing/demos/abstract-silk.mp4" poster="/marketing/demos/abstract-silk-poster.webp" title="Flowing monochrome abstract ribbons" onError={() => setError(true)} /></div>
    {error && <p className="kd-video-error" role="alert">Video unavailable. <button className="ui-control kd-button" type="button" onClick={() => { setError(false); setAttempt(value => value + 1); }}>Retry video</button></p>}
  </div>;
}
