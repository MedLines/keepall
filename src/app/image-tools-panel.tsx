"use client";

import Link from "next/link";
import { Tooltip } from "@base-ui/react/tooltip";
import { ContextMenu } from "@base-ui/react/context-menu";
import { motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ScrollPanel } from "@/components/ui/scroll-panel";
import type { ImageItem } from "@/domain/image";
import type { ImageAnalysis } from "@/domain/image-analysis";
import { saveImageAnalysis } from "@/persistence/image-analysis";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { ITEM_DETAILS_CONTROL } from "./item-page-styles";
import { CheckIcon, ChevronDownIcon, CloseIcon, CopyIcon, OcrIcon, PaletteIcon, SearchIcon } from "./shell-icons";
import { SHELL_TOOLTIP } from "./shell-styles";
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

function swatchTextColor(hex: string) {
  const rgb = [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const blackContrast = (luminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (luminance + 0.05);
  return blackContrast >= whiteContrast ? "#000000" : "#FFFFFF";
}

function ResultSection({ title, icon, action, children }: {
  title: string; icon: ReactNode; action?: ReactNode; children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const contentId = useId();
  return <div className="library-panel squircle-panel min-w-0 rounded-panel border border-border-control bg-bg-surface p-4 sm:p-5">
    <div className="flex items-center gap-2">
      <h2 className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-text-primary">{icon}<span>{title}</span></h2>
      {action}
      <button type="button" aria-label={title} title={`${expanded ? "Collapse" : "Expand"} ${title}`} aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(value => !value)} className={styles.sectionToggle}>
        <ChevronDownIcon className={`size-4 ${expanded ? "" : "-rotate-90"}`} />
      </button>
    </div>
    <div id={contentId} hidden={!expanded} className="space-y-3 pt-2">{children}</div>
  </div>;
}

function CopyFeedback({ copied }: { copied: boolean }) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : { type: "spring" as const, duration: 0.3, bounce: 0 };
  const visible = { opacity: 1, scale: 1, filter: "blur(0px)" };
  const hidden = { opacity: 0, scale: reduceMotion ? 1 : 0.25, filter: reduceMotion ? "blur(0px)" : "blur(4px)" };
  return <span aria-hidden="true" data-copy-feedback data-copied={copied} className="relative block size-4">
    <motion.span data-copy-icon="copy" initial={false} animate={copied ? hidden : visible} transition={transition} className="absolute inset-0"><CopyIcon className="size-4" /></motion.span>
    <motion.span data-copy-icon="check" initial={false} animate={copied ? visible : hidden} transition={transition} className="absolute inset-0"><CheckIcon className="size-4" /></motion.span>
  </span>;
}

function PaletteSection({ palette, copied, onCopy }: {
  palette: string[];
  copied: string | null;
  onCopy: (value: string, key: string) => void;
}) {
  return <ResultSection title="Palette" icon={<PaletteIcon className="size-4" />}>
    {palette.length ? <Tooltip.Provider delay={250}>
        <ul className={styles.palette} aria-label="Image colors">
          {palette.map(hex => <li key={hex}><PaletteSwatch hex={hex} copied={copied === hex} onCopy={() => onCopy(hex, hex)} /></li>)}
        </ul>
      </Tooltip.Provider> : <p className="text-sm text-text-secondary">No opaque colors found.</p>}
  </ResultSection>;
}

function PaletteSwatch({ hex, copied, onCopy }: { hex: string; copied: boolean; onCopy: () => void }) {
  const menuItem = "ui-menu-item flex w-full items-center gap-2 text-left text-sm text-text-primary outline-none data-[highlighted]:bg-bg-active";
  return <ContextMenu.Root>
    <Tooltip.Root>
      <Tooltip.Trigger render={<ContextMenu.Trigger render={<button type="button" />} onKeyDown={event => {
        if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
        event.preventDefault();
        const bounds = event.currentTarget.getBoundingClientRect();
        event.currentTarget.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: bounds.left + bounds.width / 2, clientY: bounds.bottom }));
      }} />} className={`ui-control ${styles.swatch}`} style={{ backgroundColor: hex, color: swatchTextColor(hex) }} aria-label={`Copy color ${hex}`} onClick={onCopy}>
        <span className="font-mono text-xs tabular-nums">{hex}</span>
        <span className={styles.swatchFeedback} data-copied={copied}><CopyFeedback copied={copied} /></span>
      </Tooltip.Trigger>
      <Tooltip.Portal><Tooltip.Positioner side="top" sideOffset={8} className="z-[100]"><Tooltip.Popup className={SHELL_TOOLTIP}>{hex}</Tooltip.Popup></Tooltip.Positioner></Tooltip.Portal>
    </Tooltip.Root>
    <ContextMenu.Portal>
      <ContextMenu.Positioner sideOffset={4} collisionPadding={8} positionMethod="fixed" className="z-[60]">
        <ContextMenu.Popup aria-label={`Color ${hex}`} className="ui-menu-popup ui-popover w-72 max-w-[calc(100vw-1rem)] outline-none">
          <ContextMenu.Group>
            <ContextMenu.GroupLabel className="px-3 py-2 text-xs text-text-secondary">{hex}</ContextMenu.GroupLabel>
            <ContextMenu.Item className={menuItem} onClick={onCopy}><CopyIcon className="size-4" />Copy color</ContextMenu.Item>
            <ContextMenu.LinkItem closeOnClick render={<Link href={`/?q=${encodeURIComponent(`color:${hex}`)}`} />} className={menuItem}><SearchIcon className="size-4" />Search library for nearby colors</ContextMenu.LinkItem>
          </ContextMenu.Group>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  </ContextMenu.Root>;
}

function ScreenshotTextSection({ ocr, slide, copied, onCopy }: {
  ocr: NonNullable<ImageAnalysis["ocr"]>;
  slide: number;
  copied: boolean;
  onCopy: (value: string, key: string) => void;
}) {
  return <ResultSection title="Screenshot text" icon={<OcrIcon className="size-4" />} action={ocr.text ? <button type="button" className="ui-control flex size-11 shrink-0 items-center justify-center" aria-label="Copy text" title="Copy text" onClick={() => onCopy(ocr.text, "ocr")}><CopyFeedback copied={copied} /></button> : null}>
    <p className="text-xs text-text-secondary" title="Recognized text may contain mistakes.">English · {Math.round(ocr.confidence)}% confidence</p>
    {ocr.text ? <ScrollPanel role="region" aria-label={`Extracted text from image ${slide + 1}`} className={styles.text} viewportClassName="max-h-64 px-4 py-3" viewportProps={{ tabIndex: 0 }}>
      <p className="select-text whitespace-pre-wrap break-words text-sm leading-6 text-text-primary [overflow-wrap:anywhere]">{ocr.text}</p>
    </ScrollPanel> : <p className="text-sm text-text-secondary">No text found. Try a sharper image or a closer crop.</p>}
  </ResultSection>;
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
