"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ScrollPanel } from "@/components/ui/scroll-panel";
import type { ImageItem } from "@/domain/image";
import { paletteColorFamily, type ImageAnalysis } from "@/domain/image-analysis";
import { saveImageAnalysis } from "@/persistence/image-analysis";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { ITEM_DETAILS_CONTROL } from "./item-page-styles";
import { CheckIcon, CloseIcon, CopyIcon, PaletteIcon, PlainTextIcon, SearchIcon } from "./shell-icons";
import styles from "./image-tools-panel.module.css";

type Tool = "palette" | "ocr";
type Job = { kind: Tool; status: string; progress: number };

export type ImageToolActions = {
  disabled: boolean;
  running: boolean;
  paletteLabel: string;
  textLabel: string;
  retryLabel: string | null;
  onPalette: () => void;
  onReadText: () => void;
  onRetry: () => void;
  onCancel: () => void;
};

const ImageToolsContext = createContext<ImageToolActions | null>(null);

export function useImageToolActions() {
  const actions = useContext(ImageToolsContext);
  if (!actions) throw new Error("Image actions need their image tools provider.");
  return actions;
}

export function ImageToolsPanel({ item, assetId, slide, disabled = false, children }: {
  item: ImageItem; assetId: string; slide: number; disabled?: boolean;
  children?: ReactNode;
}) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<{ kind: Tool | null; message: string } | null>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const analysis = item.analysis?.find(entry => entry.assetId === assetId);

  useEffect(() => () => { controller.current?.abort(); }, []);

  async function run(kind: Tool) {
    if (controller.current || disabled) return;
    const abort = new AbortController();
    controller.current = abort;
    setError(null);
    setMessage("");
    setJob({ kind, status: kind === "ocr" ? "Preparing image" : "Finding colors", progress: 0 });
    try {
      const tools = await import("./image-analysis-client");
      abort.signal.throwIfAborted();
      const result = kind === "palette" ? await tools.extractImagePalette(assetId, abort.signal)
        : await tools.recognizeImageText(assetId, abort.signal, (status, progress) => setJob({ kind, status, progress }));
      abort.signal.throwIfAborted();
      await saveImageAnalysis(item.id, result);
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
      setMessage(kind === "palette" ? "Palette saved" : "Text saved and searchable");
    } catch (caught) {
      if (abort.signal.aborted) setMessage("Cancelled");
      else setError({ kind, message: caught instanceof Error ? caught.message : "Couldn't analyze this image." });
    } finally {
      controller.current = null;
      setJob(null);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setMessage(`Copied ${value.length < 20 ? value : "text"}`);
      setError(null);
    } catch {
      setError({ kind: null, message: "Couldn't copy. Select the text and copy it manually." });
    }
  }

  const actions: ImageToolActions = {
    disabled: !!job || disabled,
    running: !!job,
    paletteLabel: analysis?.palette ? "Refresh palette" : "Extract palette",
    textLabel: analysis?.ocr ? "Read text again" : "Read text",
    retryLabel: error?.kind ? error.kind === "ocr" ? "Retry reading text" : "Retry palette" : null,
    onPalette: () => void run("palette"),
    onReadText: () => void run("ocr"),
    onRetry: () => { if (error?.kind) void run(error.kind); },
    onCancel: () => controller.current?.abort(),
  };
  return <ImageToolsContext.Provider value={actions}>
    {children}
    <ImageResults analysis={analysis} slide={slide} job={job} error={error} message={message} copied={copied} onCopy={value => void copy(value)} onCancel={actions.onCancel} />
  </ImageToolsContext.Provider>;
}

function ImageResults({ analysis, slide, job, error, message, copied, onCopy, onCancel }: {
  analysis: ImageAnalysis | undefined;
  slide: number;
  job: Job | null;
  error: { kind: Tool | null; message: string } | null;
  message: string;
  copied: string | null;
  onCopy: (value: string) => void;
  onCancel: () => void;
}) {
  if (!analysis?.palette && !analysis?.ocr && !job && !error && !message) return null;
  return <section data-image-tools aria-label={`Image ${slide + 1} tools`} className="mt-4 min-w-0 space-y-5">
    {analysis?.palette ? <PaletteSection palette={analysis.palette} copied={copied} onCopy={onCopy} /> : null}
    {analysis?.ocr ? <ScreenshotTextSection ocr={analysis.ocr} slide={slide} onCopy={onCopy} /> : null}
    {job ? <AnalysisProgress job={job} onCancel={onCancel} /> : null}
    {error ? <p role="alert" className="text-sm leading-6 text-text-danger">{error.message}</p> : null}
    {message ? <p role="status" className="text-xs text-text-secondary">{message}</p> : null}
  </section>;
}

function swatchTextColor(hex: string) {
  const rgb = [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const blackContrast = (luminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (luminance + 0.05);
  return blackContrast >= whiteContrast ? "#000000" : "#FFFFFF";
}

function PaletteSection({ palette, copied, onCopy }: {
  palette: string[];
  copied: string | null;
  onCopy: (value: string) => void;
}) {
  return <div className="space-y-2">
    <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary"><PaletteIcon className="size-4" />Palette</h2>
    {palette.length ? <>
      <ul className={styles.palette} aria-label="Image colors">
        {palette.map(hex => <li key={hex} className="flex items-center gap-1">
          <button type="button" className={`ui-control ${styles.swatch}`} style={{ backgroundColor: hex, color: swatchTextColor(hex) }} aria-label={`Copy color ${hex}`} title={`Copy ${hex}`} onClick={() => onCopy(hex)}>
            <span className="text-xs font-medium tabular-nums">{hex}</span>
            {copied === hex ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
          </button>
          <Link href={`/?q=${encodeURIComponent(`color:${hex}`)}`} aria-label={`Find similar ${paletteColorFamily(hex)} images`} title={`Find colors near ${hex}`} className="ui-control flex size-11 items-center justify-center text-text-secondary hover:text-text-primary"><SearchIcon className="size-4" /></Link>
        </li>)}
      </ul>
      <p className="text-xs text-text-secondary">Click a color to copy. Search includes nearby shades.</p>
    </> : <p className="text-sm text-text-secondary">No opaque colors found.</p>}
  </div>;
}

function ScreenshotTextSection({ ocr, slide, onCopy }: {
  ocr: NonNullable<ImageAnalysis["ocr"]>;
  slide: number;
  onCopy: (value: string) => void;
}) {
  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary"><PlainTextIcon className="size-4" />Screenshot text</h2>
      {ocr.text ? <button type="button" className="ui-control flex size-11 items-center justify-center" aria-label="Copy text" title="Copy text" onClick={() => onCopy(ocr.text)}><CopyIcon className="size-4" /></button> : null}
    </div>
    <p className="text-xs text-text-secondary" title="Recognized text may contain mistakes.">English · {Math.round(ocr.confidence)}% confidence</p>
    {ocr.text ? <ScrollPanel role="region" aria-label={`Extracted text from image ${slide + 1}`} className={styles.text} viewportClassName="max-h-64 px-4 py-3" viewportProps={{ tabIndex: 0 }}>
      <p className="select-text whitespace-pre-wrap break-words text-sm leading-6 text-text-primary [overflow-wrap:anywhere]">{ocr.text}</p>
    </ScrollPanel> : <p className="text-sm text-text-secondary">No text found. Try a sharper image or a closer crop.</p>}
  </div>;
}

function AnalysisProgress({ job, onCancel }: { job: Job; onCancel: () => void }) {
  const percent = Math.round(job.progress * 100);
  return (
    <div className="mt-3 flex items-center gap-3" aria-busy="true">
      <div className="min-w-0 flex-1 space-y-2">
        <p role="status" className="flex items-center justify-between gap-2 text-xs text-text-secondary"><span>{job.status}</span><span className="tabular-nums">{percent}%</span></p>
        <div role="progressbar" aria-label={job.status} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="h-1 overflow-hidden rounded-full bg-bg-control">
          <div className="h-full origin-left rounded-full bg-text-secondary" style={{ transform: `scaleX(${job.progress})` }} />
        </div>
      </div>
      <button type="button" className={ITEM_DETAILS_CONTROL} onClick={onCancel}><CloseIcon className="size-3.5" />Cancel</button>
    </div>
  );
}
