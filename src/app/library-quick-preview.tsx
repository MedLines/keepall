"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ScrollPanel } from "@/components/ui/scroll-panel";

import { Dialog } from "@base-ui/react/dialog";
import { Tooltip } from "@base-ui/react/tooltip";
import { useEffect, useId, useRef, useState } from "react";
import { itemListTitle, type Item } from "@/domain/item";
import { LibraryItemMedia } from "./library-item-media";
import { NoteContent } from "./note-content";
import { DocumentContent } from "./document-content";
import { getVideoBlob } from "@/persistence/videos";
import { SegmentedControl } from "./segmented-control";
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon, ExternalLinkIcon, LinkIcon, NoteIcon } from "./shell-icons";
import { ItemTypeIcon } from "./item-type-icon";
import { MediaViewerToolbar } from "./media-viewer-toolbar";
import { linkCardHost } from "@/domain/card-display";

type Props = {
  item: Item | null;
  index: number;
  count: number;
  onMove: (step: number) => void;
  onClose: () => void;
  onOpenItem: (item: Item) => void;
  returnFocus: () => HTMLElement | null;
};

export function LibraryQuickPreview({ item, index, count, onMove, onClose, onOpenItem, returnFocus }: Props) {
  const popupRef = useRef<HTMLDivElement>(null);
  const title = item ? previewTitle(item) : "";
  return <Dialog.Root open={item !== null} onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Backdrop className="ui-backdrop fixed inset-0 z-[80]" />
      <Dialog.Viewport className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto p-4">
        <Dialog.Popup ref={popupRef} finalFocus={returnFocus} initialFocus={popupRef}
          className="library-quick-preview confirm-dialog-popup ui-popover flex h-[min(48rem,calc(100dvh-2rem))] w-full max-w-4xl flex-col overflow-hidden p-0 outline-none"
          onKeyDown={event => {
            if (event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onClose();
              return;
            }
            const target = event.target as HTMLElement;
            if (target.closest("input, textarea, select, video, [contenteditable=true]")) return;
            if (["ArrowUp", "ArrowDown"].includes(event.key) && target.closest("[data-preview-scroll]")) return;
            if (event.key.startsWith("Arrow")) {
              event.preventDefault();
              popupRef.current?.focus({ preventScroll: true });
              onMove(event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1);
            } else if (target === event.currentTarget && event.key === " ") {
              event.preventDefault();
              onClose();
            } else if (target === event.currentTarget && event.key === "Enter" && item) {
              event.preventDefault();
              onOpenItem(item);
            }
          }}
        >
          {item ? <>
            <header className="flex shrink-0 items-center gap-4 px-5 py-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-control bg-bg-raised text-text-secondary">
                <ItemTypeIcon item={item} className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <PreviewTitle key={title} title={title} />
                <p className="mt-1 truncate text-xs text-text-secondary">{item.type === "document" ? item.sourceFileName : item.type === "link" ? linkCardHost(item) : item.type === "image" ? `${item.assetIds.length} ${item.assetIds.length === 1 ? "image" : "images"}` : item.type === "video" ? "Local video" : item.format === "markdown" ? "Markdown" : "Plain text"}</p>
              </div>
              <Dialog.Description className="sr-only">Quick preview. Arrows browse items. Enter opens the full item.</Dialog.Description>
              <Dialog.Close aria-label="Close preview" className="ui-control flex size-11 shrink-0 items-center justify-center"><CloseIcon /></Dialog.Close>
            </header>
            <div key={item.id} className="min-h-0 flex-1 overflow-hidden outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-border-focus" tabIndex={0} role="region" aria-label="Preview content">
              <PreviewContent item={item} onGalleryStep={() => popupRef.current?.focus({ preventScroll: true })} />
            </div>
            <footer className="library-preview-footer shrink-0 border-t border-border-control px-5 py-3">
              <div className="library-preview-navigation flex items-center gap-2">
                <button type="button" className="ui-control flex size-11 shrink-0 items-center justify-center disabled:opacity-50" aria-label="Previous item" title="Previous item" disabled={index <= 0} onClick={() => onMove(-1)}><ArrowLeftIcon className="size-4 rtl:rotate-180" /></button>
                <span role="status" aria-live="polite" className="whitespace-nowrap text-sm tabular-nums text-text-secondary"><span className="sr-only">{title}. </span>{index + 1} of {count}</span>
                <button type="button" className="ui-control flex size-11 shrink-0 items-center justify-center disabled:opacity-50" aria-label="Next item" title="Next item" disabled={index >= count - 1} onClick={() => onMove(1)}><ArrowRightIcon className="size-4 rtl:rotate-180" /></button>
              </div>
              <button type="button" className="ui-control min-h-11 px-3 text-sm" onClick={() => onOpenItem(item)}>Open full item</button>
            </footer>
          </> : null}
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>;
}

function previewTitle(item: Item): string {
  if (item.title.trim()) return item.title;
  if (item.type === "link") return itemListTitle(item);
  return item.type === "note" ? "Untitled note" : item.type === "image" ? "Image" : "Video";
}

function PreviewTitle({ title }: { title: string }) {
  const titleRef = useRef<HTMLElement>(null);
  const tooltipId = useId();
  const [truncated, setTruncated] = useState(false);
  useEffect(() => {
    const node = titleRef.current;
    if (!node) return;
    const measure = () => setTruncated(node.scrollWidth > node.clientWidth);
    const frame = requestAnimationFrame(measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(node);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  return <Dialog.Title className="min-w-0 flex-1 text-lg font-semibold text-text-primary">
    <Tooltip.Root disabled={!truncated}>
      <Tooltip.Trigger ref={(node: HTMLElement | null) => { titleRef.current = node; }} render={<span />} tabIndex={truncated ? 0 : -1} aria-describedby={truncated ? tooltipId : undefined} delay={350}
        className="block truncate rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-border-focus">
        {title}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner side="bottom" align="start" sideOffset={8} collisionPadding={16} className="z-[90]">
          <Tooltip.Popup id={tooltipId} role="tooltip" className="ui-popover flex max-h-[min(16rem,40dvh)] max-w-[min(32rem,calc(100vw-2rem))] flex-col overflow-hidden px-3 py-2 text-sm font-normal"><ScrollArea className="flex min-h-0 flex-col" viewportClassName="min-h-0 flex-1 whitespace-pre-wrap break-words">{title}</ScrollArea></Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Dialog.Title>;
}

function PreviewContent({ item, onGalleryStep }: { item: Item; onGalleryStep: () => void }) {
  if (item.type === "note") return <ScrollPanel className="h-full min-h-0" viewportClassName="scroll-fade overscroll-contain px-5" contentClassName="!flex min-h-full" viewportProps={{ "data-preview-scroll": "", tabIndex: 0 }}>
    <NoteContent className="library-preview-document mx-auto w-full max-w-[65ch] shrink-0 py-5" content={item.content} format={item.format ?? "plain"} />
  </ScrollPanel>;
  if (item.type === "image") return <ImagePreview item={item} onGalleryStep={onGalleryStep} />;
  if (item.type === "video") return <div className="flex h-full min-h-0 flex-col gap-4 px-5 pb-5">
    <div className="grid min-h-0 min-w-0 flex-1 place-items-center" data-preview-media>
      <PreviewVideo key={item.assetId} assetId={item.assetId} title={previewTitle(item)} />
    </div>
    {item.noteContent ? <ScrollPanel className="flex max-h-[35%] shrink-0 flex-col" viewportClassName="scroll-fade min-h-0 flex-1 overscroll-contain" viewportProps={{ "data-preview-scroll": "", tabIndex: 0, role: "region", "aria-label": "Video notes" }}>
      <NoteContent className="library-preview-document mx-auto max-w-[65ch]" content={item.noteContent} format={item.noteFormat ?? "plain"} />
    </ScrollPanel> : null}
  </div>;
  if (item.type === "document") return <ScrollPanel className="h-full min-h-0" viewportClassName="overscroll-contain px-5 pb-5" viewportProps={{ "data-preview-scroll": "", "data-document-scroll": "", tabIndex: 0 }}>
    <div className={item.format === "pdf" ? "min-w-0 pt-3" : "library-preview-document mx-auto max-w-[65ch] py-5"}><DocumentContent item={item} /></div>
    {item.noteContent ? <section aria-label="Document notes" className="mx-auto mt-5 max-w-[65ch] border-t border-border-control pt-4"><p className="mb-3 flex items-center gap-2 text-xs font-medium text-text-secondary"><NoteIcon className="size-4" />Notes</p><NoteContent content={item.noteContent} format={item.noteFormat ?? "plain"} /></section> : null}
  </ScrollPanel>;
  const details = <div className="mx-auto flex w-full max-w-[65ch] flex-col gap-4">
    <a href={item.url} target="_blank" rel="noreferrer" aria-label={`Open source: ${item.url}`} className="ui-control inline-flex min-h-11 max-w-full self-start items-center gap-2 px-3 text-sm text-text-secondary"><LinkIcon className="size-4" /><span className="truncate">{linkCardHost(item)}</span><ExternalLinkIcon className="size-4" /></a>
    {item.previewDescription ? <p className="whitespace-pre-wrap break-words text-text-secondary">{item.previewDescription}</p> : null}
    {item.noteContent ? <section aria-label="Link notes" className="border-t border-border-control pt-4"><p className="mb-3 flex items-center gap-2 text-xs font-medium text-text-secondary"><NoteIcon className="size-4" />Notes</p><NoteContent className="library-preview-document" content={item.noteContent} format={item.noteFormat ?? "plain"} /></section> : null}
  </div>;
  return item.previewAssetId ? <div className="flex h-full min-h-0 flex-col gap-4 px-5 pb-5">
    <div className="grid min-h-0 min-w-0 flex-1 place-items-center" data-preview-media>
      <LibraryItemMedia item={item} variant="preview" />
    </div>
    <ScrollPanel className="flex max-h-[35%] shrink-0 flex-col" viewportClassName="scroll-fade min-h-0 flex-1 overscroll-contain" viewportProps={{ "data-preview-scroll": "", tabIndex: 0, role: "region", "aria-label": "Link details" }}>{details}</ScrollPanel>
  </div> : <ScrollPanel className="h-full min-h-0" viewportClassName="scroll-fade overscroll-contain px-5" contentClassName="!flex min-h-full" viewportProps={{ "data-preview-scroll": "", tabIndex: 0 }}><div className="m-auto w-full shrink-0 py-5">{details}</div></ScrollPanel>;
}

function ImagePreview({ item, onGalleryStep }: { item: Extract<Item, { type: "image" }>; onGalleryStep: () => void }) {
  const [slide, setSlide] = useState(0);
  const [imageSizing, setImageSizing] = useState<"fit" | "scroll">("fit");
  return <div className="media-viewer-frame flex h-full min-h-0 flex-col gap-4 px-5 pb-5 pt-3">
    <MediaViewerToolbar view={<SegmentedControl label="Image sizing" value={imageSizing} onChange={setImageSizing} className="w-40"
      choices={[{ value: "fit", label: "Fit", ariaLabel: "Fit image" }, { value: "scroll", label: "Scroll", ariaLabel: "Scroll image" }]} />}
      navigation={<div className="flex items-center justify-center gap-2">
        <button type="button" className="ui-control flex size-11 shrink-0 items-center justify-center disabled:opacity-40" aria-label="Previous gallery image" title="Previous gallery image" disabled={slide === 0} onClick={() => { onGalleryStep(); setSlide(slide - 1); }}><ArrowLeftIcon className="size-4 rtl:rotate-180" /></button>
        <span className="whitespace-nowrap text-sm tabular-nums text-text-secondary">Image {slide + 1} of {item.assetIds.length}</span>
        <button type="button" className="ui-control flex size-11 shrink-0 items-center justify-center disabled:opacity-40" aria-label="Next gallery image" title="Next gallery image" disabled={slide >= item.assetIds.length - 1} onClick={() => { onGalleryStep(); setSlide(slide + 1); }}><ArrowRightIcon className="size-4 rtl:rotate-180" /></button>
      </div>} />
    <ScrollPanel key={slide} orientation="both" className="min-h-0 min-w-0 flex-1"
      viewportProps={{ "data-preview-media": "", "data-image-sizing": imageSizing, "data-preview-scroll": imageSizing === "scroll" ? "" : undefined, tabIndex: imageSizing === "scroll" ? 0 : -1, role: "region", "aria-label": "Image viewport" }}>
      <LibraryItemMedia item={item} variant="preview" assetId={item.assetIds[slide]} />
    </ScrollPanel>
    {item.caption ? <ScrollPanel className="flex max-h-[35%] shrink-0 flex-col" viewportClassName="scroll-fade min-h-0 flex-1 overscroll-contain" viewportProps={{ "data-preview-scroll": "", tabIndex: 0, role: "region", "aria-label": "Image notes" }}>
      <NoteContent className="library-preview-document mx-auto max-w-[65ch]" content={item.caption} format={item.captionFormat ?? "plain"} />
    </ScrollPanel> : null}
  </div>;
}

function PreviewVideo({ assetId, title }: { assetId: string; title: string }) {
  const [media, setMedia] = useState<{ url: string | null; error: boolean }>({ url: null, error: false });
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    void getVideoBlob(assetId).then(blob => {
      if (cancelled) return;
      if (!blob) { setMedia({ url: null, error: true }); return; }
      url = URL.createObjectURL(blob);
      setMedia({ url, error: false });
    }).catch(() => { if (!cancelled) setMedia({ url: null, error: true }); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [assetId]);
  if (media.error) return <p role="alert" className="text-sm text-text-secondary">This video could not be previewed. Open the full item to retry or check its saved file.</p>;
  return media.url
    ? <video controls playsInline preload="metadata" src={media.url} aria-label={title} className="block h-auto w-auto max-h-full max-w-full rounded-input object-contain" onError={() => setMedia({ url: null, error: true })} />
    : <p role="status" className="text-sm text-text-secondary">Loading video…</p>;
}
