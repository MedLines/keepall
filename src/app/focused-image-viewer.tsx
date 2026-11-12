"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useLayoutEffect, useRef, useState } from "react";
import { buttonClassName, iconButtonClassName } from "@/components/ui/button";
import { ScrollPanel } from "@/components/ui/scroll-panel";
import { clampImageSlideIndex } from "@/domain/image";
import type { Item } from "@/domain/item";
import { LibraryItemMedia } from "./library-item-media";
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon, FullScreenIcon } from "./shell-icons";

const CONTROL =
  buttonClassName({ size: "none", className: "min-h-11 gap-2 px-3 text-sm font-medium disabled:cursor-default disabled:opacity-40" });

/** The clickable stage image inside ItemMediaFrame; opens FocusedImageViewer. */
export function MediaViewerTrigger({ item, assetId, label, onOpen }: {
  item: Item;
  assetId: string | null;
  label: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="control-shape-none image-viewer-trigger group relative flex size-full min-h-0 min-w-0 items-center justify-center overflow-hidden p-3 sm:p-5"
      aria-label={label}
      onClick={onOpen}
    >
      <LibraryItemMedia
        item={item}
        variant="canvas"
        assetId={assetId}
        sharedTransition={false}
      />
      <span className={iconButtonClassName({ size: "lg", className: "pointer-events-none absolute bottom-3 right-3 shrink opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" })}>
        <FullScreenIcon />
      </span>
    </button>
  );
}

export function FocusedImageViewer({
  item,
  assetId,
  assetIds,
  open,
  currentSlide,
  onOpenChange,
  onSlideChange,
}: {
  item: Item;
  assetId: string | null;
  /** Ordered images the viewer can step through; arrows appear for two or more. */
  assetIds: string[];
  open: boolean;
  currentSlide: number;
  onOpenChange: (open: boolean) => void;
  onSlideChange: (slide: number) => void;
}) {
  const [zoom, setZoom] = useState<{ width: number; x: number; y: number; clientX: number; clientY: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageButtonRef = useRef<HTMLButtonElement>(null);
  const beforeZoom = useRef<{ left: number; top: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const dragged = useRef(false);
  const slideCount = assetIds.length;

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const button = imageButtonRef.current;
    if (!viewport || !button) return;
    if (zoom) {
      const bounds = button.getBoundingClientRect();
      viewport.scrollLeft += bounds.left + bounds.width * zoom.x - zoom.clientX;
      viewport.scrollTop += bounds.top + bounds.height * zoom.y - zoom.clientY;
    } else if (beforeZoom.current) {
      viewport.scrollLeft = beforeZoom.current.left;
      viewport.scrollTop = beforeZoom.current.top;
      beforeZoom.current = null;
    }
  }, [zoom]);

  function changeSlide(next: number) {
    beforeZoom.current = null;
    setZoom(null);
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = 0;
      viewportRef.current.scrollTop = 0;
    }
    onSlideChange(next);
  }

  function toggleZoom(event: React.MouseEvent<HTMLButtonElement>) {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    if (zoom) {
      setZoom(null);
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const viewport = viewportRef.current;
    if (!viewport || !bounds.width) return;
    const clientX = event.detail === 0 ? (Math.max(0, bounds.left) + Math.min(bounds.right, viewport.clientWidth)) / 2 : event.clientX;
    const clientY = event.detail === 0 ? (Math.max(0, bounds.top) + Math.min(bounds.bottom, viewport.clientHeight)) / 2 : event.clientY;
    beforeZoom.current = { left: viewport.scrollLeft, top: viewport.scrollTop };
    setZoom({
      width: bounds.width * 2,
      x: Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height)),
      clientX,
      clientY,
    });
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setZoom(null);
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="focused-image-backdrop fixed inset-0 z-[90]" data-zoomed={zoom !== null} />
        <Dialog.Viewport
          className="fixed inset-0 z-[90] overflow-hidden"
        >
          <ScrollPanel orientation="both" className="size-full" viewportRef={node => { viewportRef.current = node; }}
            viewportClassName="p-2 sm:p-5" contentClassName="min-h-full" viewportProps={{ "data-testid": "focused-image-scroll" }}>
          <Dialog.Popup
            className={`relative mx-auto grid min-h-full place-items-center outline-none ${zoom ? "w-max min-w-full" : "w-full max-w-[100rem]"}`}
            onKeyDownCapture={(event) => {
              if (event.altKey || event.ctrlKey || event.metaKey || slideCount < 2) return;
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              event.stopPropagation();
              changeSlide(clampImageSlideIndex(
                assetIds,
                currentSlide + (event.key === "ArrowRight" ? 1 : -1),
              ));
            }}
          >
            <Dialog.Title className="sr-only">Focused image viewer</Dialog.Title>
            <button
              ref={imageButtonRef}
              type="button"
              className={`control-shape-none mx-auto block p-0 focus-visible:outline-1 focus-visible:outline-border-focus ${zoom ? "cursor-grab active:cursor-grabbing" : "w-fit max-w-full cursor-zoom-in"}`}
              style={zoom ? { width: zoom.width } : undefined}
              aria-label={zoom ? "Zoom out image" : "Zoom in image"}
              aria-pressed={zoom !== null}
              onClick={toggleZoom}
              onDragStart={event => event.preventDefault()}
              onPointerDown={event => {
                dragged.current = false;
                const viewport = viewportRef.current;
                if (!zoom || !viewport || event.pointerType !== "mouse" || event.button !== 0) return;
                drag.current = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={event => {
                const start = drag.current;
                const viewport = viewportRef.current;
                if (!start || !viewport) return;
                const dx = event.clientX - start.x;
                const dy = event.clientY - start.y;
                if (Math.hypot(dx, dy) > 4) dragged.current = true;
                if (dragged.current) {
                  viewport.scrollLeft = start.left - dx;
                  viewport.scrollTop = start.top - dy;
                }
              }}
              onPointerUp={event => {
                drag.current = null;
                if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              onPointerCancel={() => { drag.current = null; }}
            >
              <LibraryItemMedia item={item} variant="viewer" assetId={assetId} className={zoom ? "!w-full" : "max-h-[calc(100dvh-5rem)] object-contain"} />
            </button>
            <Dialog.Close className={`${CONTROL} fixed right-3 top-3 z-10 bg-bg-surface/95 backdrop-blur-sm`} aria-label="Close full-screen image">
              <CloseIcon />
            </Dialog.Close>
            {zoom ? (
              <button className={`${CONTROL} fixed left-3 top-3 z-10 bg-bg-surface/95 backdrop-blur-sm`} type="button" onClick={() => setZoom(null)}>
                Zoom out
              </button>
            ) : null}
            {slideCount > 1 ? (
              <>
                <button className={iconButtonClassName({ size: "md", className: "fixed left-3 top-1/2 z-10 size-14 -translate-y-1/2 bg-bg-surface/95 backdrop-blur-sm disabled:cursor-default disabled:opacity-40 shrink" })} type="button" aria-label="Previous full-screen image" disabled={currentSlide === 0} onClick={() => changeSlide(currentSlide - 1)}>
                  <ArrowLeftIcon className="size-6" />
                </button>
                <button className={iconButtonClassName({ size: "md", className: "fixed right-3 top-1/2 z-10 size-14 -translate-y-1/2 bg-bg-surface/95 backdrop-blur-sm disabled:cursor-default disabled:opacity-40 shrink" })} type="button" aria-label="Next full-screen image" disabled={currentSlide === slideCount - 1} onClick={() => changeSlide(currentSlide + 1)}>
                  <ArrowRightIcon className="size-6" />
                </button>
              </>
            ) : null}
            <p className="pointer-events-none fixed bottom-3 left-1/2 -translate-x-1/2 rounded-control-xs bg-bg-overlay/70 px-3 py-2 text-sm tabular-nums text-text-on-media" aria-label={`Image ${currentSlide + 1} of ${slideCount}`}>
              {currentSlide + 1} / {slideCount}
            </p>
          </Dialog.Popup>
          </ScrollPanel>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
