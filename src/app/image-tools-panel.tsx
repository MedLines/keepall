"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ScrollPanel } from "@/components/ui/scroll-panel";
import type { ImageItem } from "@/domain/image";
import { paletteColorFamily, type ImageAnalysis } from "@/domain/image-analysis";
import { saveImageAnalysis } from "@/persistence/image-analysis";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { ITEM_DETAILS_CONTROL } from "./item-page-styles";
import { CheckIcon, ChevronDownIcon, CloseIcon, CopyIcon, DeviceIcon, PaletteIcon, PlainTextIcon, RefreshIcon, SearchIcon } from "./shell-icons";
import styles from "./image-tools-panel.module.css";

type Tool = "palette" | "ocr";
type Job = { kind: Tool; status: string; progress: number };

export function ImageToolsPanel({ item, assetId, slide, disabled = false }: {
  item: ImageItem; assetId: string; slide: number; disabled?: boolean;
}) {
  const disclosure = useToolsDisclosure();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<{ kind: Tool | null; message: string } | null>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const analysis = item.analysis?.find(entry => entry.assetId === assetId);

  useEffect(() => () => { controller.current?.abort(); }, []);

  async function run(kind: Tool) {
    if (controller.current || disabled) return;
    disclosure.expand(kind);
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

  return (
    <section data-image-tools aria-label={`Image ${slide + 1} tools`} className="mb-3 min-w-0 border-t border-border-control pt-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold text-text-primary">Image tools{item.assetIds.length > 1 ? ` · ${slide + 1} of ${item.assetIds.length}` : ""}</h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary"><DeviceIcon className="size-3.5" />On this device</span>
      </div>
      <PaletteSection open={disclosure.isOpen("palette")} onToggle={() => disclosure.toggle("palette")} palette={analysis?.palette} copied={copied} disabled={!!job || disabled} onRun={() => void run("palette")} onCopy={value => void copy(value)} />
      {job?.kind === "palette" ? <AnalysisProgress job={job} onCancel={() => controller.current?.abort()} /> : null}
      <ScreenshotTextSection open={disclosure.isOpen("ocr")} onToggle={() => disclosure.toggle("ocr")} ocr={analysis?.ocr} slide={slide} disabled={!!job || disabled} onRun={() => void run("ocr")} onCopy={value => void copy(value)} />
      {job?.kind === "ocr" ? <AnalysisProgress job={job} onCancel={() => controller.current?.abort()} /> : null}
      {error ? <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p role="alert" className="min-w-0 flex-1 text-xs leading-5 text-text-danger">{error.message}</p>
        {error.kind ? <button type="button" className={ITEM_DETAILS_CONTROL} disabled={!!job || disabled} onClick={() => void run(error.kind!)}><RefreshIcon className="size-4" />Retry</button> : null}
      </div> : null}
      {message ? <p role="status" className="mt-3 text-xs text-text-secondary">{message}</p> : null}
    </section>
  );
}

function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia("(min-width: 1024px)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useToolsDisclosure() {
  const desktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia("(min-width: 1024px)").matches, () => false);
  const [expanded, setExpanded] = useState<Record<Tool, boolean | null>>({ palette: null, ocr: null });
  return {
    isOpen: (kind: Tool) => expanded[kind] ?? desktop,
    toggle: (kind: Tool) => setExpanded(current => ({ ...current, [kind]: !(current[kind] ?? desktop) })),
    expand: (kind: Tool) => setExpanded(current => ({ ...current, [kind]: true })),
  };
}

function PaletteSection({ open, onToggle, palette, copied, disabled, onRun, onCopy }: {
  open: boolean;
  onToggle: () => void;
  palette: string[] | undefined;
  copied: string | null;
  disabled: boolean;
  onRun: () => void;
  onCopy: (value: string) => void;
}) {
  const contentId = useId();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="min-w-0"><button type="button" className="flex min-h-11 items-center gap-1.5 text-xs font-medium text-text-primary" aria-expanded={open} aria-controls={contentId} onClick={onToggle}><PaletteIcon className="size-4" />Palette<ChevronDownIcon className={`size-3.5 ${open ? "" : "-rotate-90"}`} /></button></h3>
        <button type="button" className={ITEM_DETAILS_CONTROL} disabled={disabled} onClick={onRun}>
          {palette ? <RefreshIcon className="size-4" /> : null}{palette ? "Refresh palette" : "Extract palette"}
        </button>
      </div>
      <div id={contentId} hidden={!open}>
        {palette ? palette.length ? (
          <>
            <ul className={styles.palette} aria-label="Image colors">
              {palette.map(hex => (
                <li key={hex} className="min-w-0">
                  <button type="button" className={styles.swatch} style={{ backgroundColor: hex }} aria-label={`Copy color ${hex}`} title={`Copy ${hex}`} onClick={() => onCopy(hex)}>
                    <span className={styles.copyMark}>{copied === hex ? <CheckIcon className="size-4" /> : <CopyIcon className="size-3.5" />}</span>
                  </button>
                  <Link href={`/?q=${encodeURIComponent(`color:${hex}`)}`} aria-label={`Find similar ${paletteColorFamily(hex)} images`} title={`Find similar ${paletteColorFamily(hex)} images`} className="mt-1 flex min-h-11 min-w-0 items-center justify-between gap-1 rounded-control px-1 text-text-secondary hover:bg-bg-raised hover:text-text-primary focus-visible:outline-1 focus-visible:outline-border-focus">
                    <span className="text-[0.6875rem] font-medium tabular-nums">{hex}</span><SearchIcon className="size-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-xs text-text-secondary">Click a color to copy. Search includes nearby shades.</p>
          </>
        ) : <p className="text-sm text-text-secondary">No opaque colors found.</p> : <p className="text-xs text-text-secondary">Copy colors or search nearby shades.</p>}
      </div>
    </div>
  );
}

function ScreenshotTextSection({ open, onToggle, ocr, slide, disabled, onRun, onCopy }: {
  open: boolean;
  onToggle: () => void;
  ocr: ImageAnalysis["ocr"];
  slide: number;
  disabled: boolean;
  onRun: () => void;
  onCopy: (value: string) => void;
}) {
  const contentId = useId();
  const hasText = Boolean(ocr?.text);
  const runLabel = ocr ? "Read text again" : "Read text";
  return (
    <div className="mt-3 space-y-2 border-t border-border-control pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="min-w-0"><button type="button" className="flex min-h-11 items-center gap-1.5 text-xs font-medium text-text-primary" aria-expanded={open} aria-controls={contentId} onClick={onToggle}><PlainTextIcon className="size-4" />Screenshot text<ChevronDownIcon className={`size-3.5 ${open ? "" : "-rotate-90"}`} /></button></h3>
        </div>
        <div className="flex items-center gap-2">
          {hasText ? <button type="button" className="ui-control flex size-11 items-center justify-center" aria-label="Copy text" title="Copy text" onClick={() => onCopy(ocr!.text)}><CopyIcon className="size-4" /></button> : null}
          <button type="button" className={hasText ? "ui-control flex size-11 items-center justify-center disabled:opacity-60" : ITEM_DETAILS_CONTROL} aria-label={runLabel} title={ocr ? runLabel : undefined} disabled={disabled} onClick={onRun}>
            {hasText ? <RefreshIcon className="size-4" /> : runLabel}
          </button>
        </div>
      </div>
      <div id={contentId} hidden={!open} className="space-y-2">
        <p className="text-xs text-text-secondary" title={ocr ? "Recognized text may contain mistakes." : undefined}>{ocr ? `English · ${Math.round(ocr.confidence)}% confidence` : "English · first use needs a connection"}</p>
        {ocr ? ocr.text ? (
          <ScrollPanel role="region" aria-label={`Extracted text from image ${slide + 1}`} className={styles.text} viewportClassName="max-h-64 px-3 py-3" viewportProps={{ tabIndex: 0 }}>
            <p className="select-text whitespace-pre-wrap break-words text-sm leading-6 text-text-primary [overflow-wrap:anywhere]">{ocr.text}</p>
          </ScrollPanel>
        ) : <p className="text-sm text-text-secondary">No text found. Try a sharper image or a closer crop.</p> : null}
      </div>
    </div>
  );
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
