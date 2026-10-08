"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { ImageItem } from "@/domain/image";
import type { ImageAnalysis } from "@/domain/image-analysis";
import { saveImageAnalysis } from "@/persistence/image-analysis";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { ITEM_DETAILS_CONTROL } from "./item-page-styles";
import { PaletteSection, ScreenshotTextSection } from "./image-tool-results";
import { CloseIcon } from "./shell-icons";

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
  const [copyStatus, setCopyStatus] = useState("");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const analysis = item.analysis?.find(entry => entry.assetId === assetId);

  useEffect(() => () => {
    controller.current?.abort();
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

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

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setCopyStatus(key === "ocr" ? "Text copied" : `${value} copied`);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 1800);
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
    <ImageResults analysis={analysis} slide={slide} job={job} error={error} message={message} copied={copied} onCopy={(value, key) => void copy(value, key)} onCancel={actions.onCancel} />
    <span role="status" className="sr-only">{copyStatus}</span>
  </ImageToolsContext.Provider>;
}

function ImageResults({ analysis, slide, job, error, message, copied, onCopy, onCancel }: {
  analysis: ImageAnalysis | undefined;
  slide: number;
  job: Job | null;
  error: { kind: Tool | null; message: string } | null;
  message: string;
  copied: string | null;
  onCopy: (value: string, key: string) => void;
  onCancel: () => void;
}) {
  if (!analysis?.palette && !analysis?.ocr && !job && !error && !message) return null;
  return <section data-image-tools aria-label={`Image ${slide + 1} tools`} className="mt-4 min-w-0 space-y-3">
    {analysis?.palette ? <PaletteSection palette={analysis.palette} copied={copied} onCopy={onCopy} /> : null}
    {analysis?.ocr ? <ScreenshotTextSection ocr={analysis.ocr} slide={slide} copied={copied === "ocr"} onCopy={onCopy} /> : null}
    {job ? <AnalysisProgress job={job} onCancel={onCancel} /> : null}
    {error ? <p role="alert" className="text-sm leading-6 text-text-danger">{error.message}</p> : null}
    {message ? <p role="status" className="text-xs text-text-secondary">{message}</p> : null}
  </section>;
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
