"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ImageItem } from "@/domain/image";
import { paletteColorFamily } from "@/domain/image-analysis";
import { saveImageAnalysis } from "@/persistence/image-analysis";
import { ITEMS_CHANGED_EVENT } from "./items-events";

const BUTTON = "ui-control min-h-11 rounded-control px-3 py-2 text-sm font-medium disabled:opacity-40";

type Job = { kind: "palette" | "ocr"; status: string; progress: number };

export function ImageToolsPanel({ item, assetId, slide, disabled = false }: {
  item: ImageItem; assetId: string; slide: number; disabled?: boolean;
}) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  const analysis = item.analysis?.find(entry => entry.assetId === assetId);

  useEffect(() => () => { controller.current?.abort(); }, []);

  async function run(kind: "palette" | "ocr") {
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
      else setError(caught instanceof Error ? caught.message : "Couldn't analyze this image. Retry.");
    } finally {
      controller.current = null;
      setJob(null);
    }
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setMessage(`Copied ${value.length < 20 ? value : "text"}`); }
    catch { setError("Couldn't copy. Select the value and copy it manually."); }
  }

  return (
    <section aria-label={`Image ${slide + 1} tools`} className="mt-8 space-y-5 border-t border-border-control pt-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Image tools{item.assetIds.length > 1 ? ` · ${slide + 1} of ${item.assetIds.length}` : ""}</h2>
        <p className="mt-1 text-sm text-text-secondary">Runs on this device. Original images stay unchanged.</p>
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-text-primary">Palette</h3>
          <button className={BUTTON} disabled={!!job || disabled} onClick={() => void run("palette")}>{analysis?.palette ? "Refresh palette" : "Extract palette"}</button>
        </div>
        {analysis?.palette ? analysis.palette.length ? (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {analysis.palette.map(hex => <li key={hex} className="rounded-control border border-border-control p-2">
              <span aria-hidden="true" className="mb-2 block h-10 rounded-control border border-border-control" style={{ backgroundColor: hex }} />
              <button className="min-h-11 w-full text-left font-mono text-sm text-text-primary" aria-label={`Copy color ${hex}`} onClick={() => void copy(hex)}>{hex}</button>
              <Link href={`/?q=${encodeURIComponent(`color:${hex}`)}`} className="block min-h-11 py-2 text-xs text-text-secondary underline underline-offset-4">Find similar {paletteColorFamily(hex)} images</Link>
            </li>)}
          </ul>
        ) : <p className="text-sm text-text-secondary">No opaque colors found.</p> : <p className="text-sm text-text-secondary">Extract a palette to copy colors or find similar images. Search also accepts color:red or color:#FF0000.</p>}
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-text-primary">Screenshot text</h3>
          <button className={BUTTON} disabled={!!job || disabled} onClick={() => void run("ocr")}>{analysis?.ocr ? "Read text again" : "Read text"}</button>
        </div>
        <p className="text-sm text-text-secondary">English recognition. The engine loads from Keepall on first use. Offline use needs those files in your browser cache.</p>
        {analysis?.ocr ? <>
          <p className="text-xs text-text-secondary">Confidence {Math.round(analysis.ocr.confidence)}%. Check recognized text against the image.</p>
          {analysis.ocr.text ? <>
            <textarea aria-label={`Extracted text from image ${slide + 1}`} readOnly value={analysis.ocr.text} rows={6} className="w-full resize-y rounded-control border border-border-control bg-bg-canvas p-3 text-sm text-text-primary" />
            <button className={BUTTON} onClick={() => void copy(analysis.ocr!.text)}>Copy text</button>
          </> : <p className="text-sm text-text-secondary">No text found. Try a sharper image or a closer crop.</p>}
        </> : null}
      </div>
      {job ? <div className="space-y-2" aria-busy="true">
        <p className="text-sm text-text-secondary" role="status">{job.status} · {Math.round(job.progress * 100)}%</p>
        <progress aria-label={job.status} value={job.progress} max={1} className="w-full" />
        <button className={BUTTON} onClick={() => controller.current?.abort()}>Cancel</button>
      </div> : null}
      {error ? <p role="alert" className="text-sm text-text-danger">{error} Use the tools above to retry.</p> : null}
      <p role="status" className="text-sm text-text-secondary">{message}</p>
    </section>
  );
}
