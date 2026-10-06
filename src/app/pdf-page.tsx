"use client";

import { ScrollPanel } from "@/components/ui/scroll-panel";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask, TextLayer } from "pdfjs-dist";
import "./pdf-viewer.css";

export function PdfPage({ document, number, zoom, viewportSize }: { document: PDFDocumentProxy; number: number; zoom: string; viewportSize?: { width: number; height: number } }) {
  const frame = useRef<HTMLDivElement>(null);
  const display = useRef<HTMLDivElement>(null);
  const staging = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const key = `${number}:${zoom}:${width}:${attempt}`;
  const [rendered, setRendered] = useState<{ key: string; error: boolean } | null>(null);

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const visible = display.current;
    const pending = staging.current;
    if (!width || !visible || !pending) return;
    const surface = visible.ownerDocument.createElement("canvas");
    surface.setAttribute("role", "img");
    surface.setAttribute("aria-label", `PDF page ${number}`);
    const layerNode = visible.ownerDocument.createElement("div");
    layerNode.className = "keepall-pdf-text";
    let active = true;
    let render: RenderTask | undefined;
    let layer: TextLayer | undefined;
    let pageProxy: PDFPageProxy | undefined;
    const work = document.getPage(number).then(async page => {
      pageProxy = page;
      if (!active) return;
      const pdf = await import("pdfjs-dist/legacy/build/pdf.mjs");
      if (!active) return;
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: zoom === "fit" ? Math.max(1, width - 2) / base.width : Number(zoom) });
      const density = Math.min(devicePixelRatio || 1, 2, Math.sqrt(16_000_000 / (viewport.width * viewport.height)), 8192 / viewport.width, 8192 / viewport.height);
      surface.width = Math.max(1, Math.floor(viewport.width * density));
      surface.height = Math.max(1, Math.floor(viewport.height * density));
      surface.style.width = `${viewport.width}px`;
      surface.style.height = `${viewport.height}px`;
      layerNode.style.setProperty("--total-scale-factor", String(viewport.scale * viewport.userUnit));
      // Paint away from the visible page so canvas resets never appear onscreen.
      pending.replaceChildren(surface, layerNode);
      render = page.render({ canvas: surface, viewport, transform: [density, 0, 0, density, 0, 0], annotationMode: pdf.AnnotationMode.DISABLE });
      layer = new pdf.TextLayer({ textContentSource: page.streamTextContent(), container: layerNode, viewport });
      await Promise.all([render.promise, layer.render()]);
      if (active) {
        visible.replaceChildren(surface, layerNode);
        setRendered({ key, error: false });
      }
    }).catch(() => {
      if (active) {
        render?.cancel(); layer?.cancel();
        surface.remove(); layerNode.remove();
        setRendered({ key, error: true });
      }
    });
    return () => {
      active = false; render?.cancel(); layer?.cancel();
      if (surface.parentElement === pending) surface.remove();
      if (layerNode.parentElement === pending) layerNode.remove();
      void work.then(() => pageProxy?.cleanup()).catch(() => {});
    };
  }, [document, number, zoom, width, attempt, key]);

  const error = rendered?.key === key && rendered.error;
  return <div ref={frame} data-pdf-ready={rendered && !rendered.error ? number : undefined} className="relative min-w-0">
    {error ? <div role="alert" className="mb-3 text-sm text-text-danger">Couldn&apos;t display this page. Try another page or download the file. <button type="button" className="ui-control min-h-9 px-3" onClick={() => setAttempt(value => value + 1)}>Retry page</button></div> : null}
    <ScrollPanel orientation="both" className="max-w-full rounded-input border border-border-control bg-bg-raised" aria-busy={rendered?.key !== key}>
      <div ref={display} className="relative mx-auto w-fit bg-white" style={viewportSize} />
    </ScrollPanel>
    <div ref={staging} aria-hidden="true" inert className="pointer-events-none invisible absolute inset-0 overflow-hidden" />
  </div>;
}
