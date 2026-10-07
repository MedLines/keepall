"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ScrollPanel } from "@/components/ui/scroll-panel";

import { Dialog } from "@base-ui/react/dialog";
import { Tooltip } from "@base-ui/react/tooltip";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { itemListTitle, type Item } from "@/domain/item";
import { LibraryItemMedia } from "./library-item-media";
import { NoteContent } from "./note-content";
import { DocumentContent } from "./document-content";
import { getVideoBlob } from "@/persistence/videos";
import { SegmentedControl } from "./segmented-control";
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon, ExternalLinkIcon, FullScreenIcon, LinkIcon, NoteIcon } from "./shell-icons";
import { ItemTypeIcon } from "./item-type-icon";
import { MediaViewerToolbar } from "./media-viewer-toolbar";
import { linkCardHost } from "@/domain/card-display";
import { useThumbnailObjectUrl } from "./use-thumbnail-object-url";

type Props = {
  item: Item | null;
  index: number;
  count: number;
  onMove: (step: number) => void;
  onClose: () => void;
  onOpenItem: (item: Item, animate?: boolean) => void;
  returnFocus: () => HTMLElement | null;
  review?: { footer: ReactNode; organization: ReactNode; emptyState: ReactNode; progress: ReactNode; busy: boolean };
};

export function LibraryQuickPreview({ item, index, count, onMove, onClose, onOpenItem, returnFocus, review }: Props) {
  const popupRef = useRef<HTMLDivElement>(null);
  const title = item ? previewTitle(item) : "";
  const reviewing = review !== undefined;
  const progress = review ? review.progress : <p role="status" aria-live="polite" className="rounded-full border border-border-edge bg-transparent px-2.5 py-1 text-center text-xs tabular-nums text-text-secondary"><span className="sr-only">{title}. </span>{index + 1} of {count}</p>;
  useEffect(() => { if (reviewing) popupRef.current?.focus({ preventScroll: true }); }, [reviewing, item?.id]);
  return <Dialog.Root open={item !== null || review !== undefined} onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>

      <Dialog.Viewport className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto p-4">
        <Dialog.Backdrop className="ui-backdrop fixed inset-0 z-0" />
        <Dialog.Popup ref={popupRef} finalFocus={returnFocus} initialFocus={popupRef}
          className="library-quick-preview confirm-dialog-popup ui-popover relative z-[1] flex h-[min(48rem,calc(100dvh-2rem))] w-full max-w-4xl flex-col gap-4 overflow-hidden p-4 outline-none"
          onKeyDown={event => {
            if (review?.busy || event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            if ((event.target as HTMLElement).closest('[role="dialog"]') !== event.currentTarget) return;
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
            <div className={`library-preview-surface relative flex min-h-[min(12rem,35dvh)] flex-1 flex-col overflow-hidden rounded-panel border border-border-edge bg-bg-card ${review ? "library-review-content" : ""}`}>
            <header className="flex shrink-0 items-start gap-4 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-control bg-bg-raised text-text-secondary">
                <ItemTypeIcon item={item} className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <PreviewTitle key={title} title={title} />
                <p className="mt-1 truncate text-xs text-text-secondary">{review ? "Unsorted review · " : ""}{item.type === "document" ? item.sourceFileName : item.type === "link" ? linkCardHost(item) : item.type === "image" ? `${item.assetIds.length} ${item.assetIds.length === 1 ? "image" : "images"}` : item.type === "video" ? "Local video" : item.format === "markdown" ? "Markdown" : "Plain text"}</p>
              </div>
              <Dialog.Description className="sr-only">{review ? "Unsorted review. Left and right arrows browse items. Collection and tag controls open the shared picker. Next leaves the item in Unsorted. Escape closes review." : "Quick preview. Arrows browse items. Enter opens the full item."}</Dialog.Description>
              <Dialog.Close disabled={review?.busy} aria-label="Close preview" className="ui-control flex size-11 shrink-0 items-center justify-center"><CloseIcon /></Dialog.Close>
            </header>
            <div key={item.id} className={`${review ? "min-h-[min(6rem,15dvh)]" : "min-h-0"} flex-1 overflow-hidden outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-border-focus`} tabIndex={0} role="region" aria-label="Preview content">
              <PreviewContent item={item} reviewing={reviewing} onGalleryStep={() => popupRef.current?.focus({ preventScroll: true })} />
            </div>
            <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center">{progress}</div>
            </div>
            {review ? review.organization : null}
            <footer className={`${review ? "library-review-footer" : "library-preview-footer"} shrink-0`}>
              {review ? review.footer : <>
              <div className="library-preview-navigation flex items-center gap-2">
                <button type="button" className="ui-control inline-flex min-h-11 shrink-0 items-center justify-center gap-2 ps-2 pe-3 text-sm disabled:opacity-50" aria-label="Previous item" title="Previous item" disabled={index <= 0} onClick={() => onMove(-1)}><ArrowLeftIcon className="size-4 rtl:rotate-180" />Back</button>
              </div>
              <div className="library-preview-confirm"><button type="button" className="ui-control ui-primary inline-flex min-h-11 items-center justify-center gap-2 ps-2 pe-3 text-sm font-medium" onClick={() => onOpenItem(item)}><FullScreenIcon className="size-4" />Open full item</button></div>
              <div className="library-preview-next"><button type="button" className="ui-control inline-flex min-h-11 shrink-0 items-center justify-center gap-2 ps-3 pe-2 text-sm disabled:opacity-50" aria-label="Next item" title="Next item" disabled={index >= count - 1} onClick={() => onMove(1)}>Next<ArrowRightIcon className="size-4 rtl:rotate-180" /></button></div>
              </>}
            </footer>
          </> : review ? <>
            <div className="library-preview-surface library-review-content relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel border border-border-edge bg-bg-card">
            <header className="flex shrink-0 items-center justify-between gap-4 p-4">
              <Dialog.Title className="text-lg font-semibold">Unsorted review</Dialog.Title>
              <Dialog.Close disabled={review.busy} aria-label="Close preview" className="ui-control flex size-11 items-center justify-center"><CloseIcon /></Dialog.Close>
            </header>
            <Dialog.Description className="sr-only">Unsorted review. Undo returns to the previous review action.</Dialog.Description>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-16">{review.emptyState}</div>
            <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center">{review.progress}</div>
            </div>
            <footer className="library-review-footer shrink-0">{review.footer}</footer>
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

function PreviewContent({ item, onGalleryStep, reviewing }: { item: Item; onGalleryStep: () => void; reviewing: boolean }) {
  if (item.type === "note") return <ScrollPanel className="h-full min-h-0" viewportClassName="scroll-fade overscroll-contain px-4" contentClassName="!flex min-h-full" viewportProps={{ "data-preview-scroll": "", tabIndex: 0 }}>

    <NoteContent className={`library-preview-document w-full shrink-0 pb-4 ${reviewing ? "" : "mx-auto max-w-[65ch]"}`} content={item.content} format={item.format ?? "plain"} />

  </ScrollPanel>;
  if (item.type === "image") return <ImagePreview item={item} onGalleryStep={onGalleryStep} />;
  if (item.type === "video") return <div className="flex h-full min-h-0 flex-col gap-4 px-4 pb-4">
    <div className="grid min-h-0 min-w-0 flex-1 place-items-center" data-preview-media>
      <PreviewVideo key={item.assetId} assetId={item.assetId} title={previewTitle(item)} />
    </div>
    {item.noteContent ? <ScrollPanel className="flex max-h-[35%] shrink-0 flex-col" viewportClassName="scroll-fade min-h-0 flex-1 overscroll-contain" viewportProps={{ "data-preview-scroll": "", tabIndex: 0, role: "region", "aria-label": "Video notes" }}>
      <NoteContent className="library-preview-document mx-auto max-w-[65ch]" content={item.noteContent} format={item.noteFormat ?? "plain"} />
    </ScrollPanel> : null}
  </div>;
  if (item.type === "document") return <ScrollPanel className="h-full min-h-0" viewportClassName="overscroll-contain px-4 pb-4" viewportProps={{ "data-preview-scroll": "", "data-document-scroll": "", tabIndex: 0 }}>
    <div className={item.format === "pdf" ? "min-w-0" : "library-preview-document mx-auto max-w-[65ch]"}><DocumentContent item={item} /></div>
    {item.noteContent ? <section aria-label="Document notes" className="mx-auto mt-5 max-w-[65ch] border-t border-border-control pt-4"><p className="mb-3 flex items-center gap-2 text-xs font-medium text-text-secondary"><NoteIcon className="size-4" />Notes</p><NoteContent content={item.noteContent} format={item.noteFormat ?? "plain"} /></section> : null}
  </ScrollPanel>;
  const details = <div className={`flex w-full flex-col gap-4 ${reviewing ? "" : "mx-auto max-w-[65ch]"}`}>
    <a href={item.url} target="_blank" rel="noreferrer" aria-label={`Open source: ${item.url}`} className="ui-control inline-flex min-h-11 max-w-full self-start items-center gap-2 px-3 text-sm text-text-secondary"><LinkIcon className="size-4" /><span className="truncate">{linkCardHost(item)}</span><ExternalLinkIcon className="size-4" /></a>
    {item.previewDescription ? <p className="whitespace-pre-wrap break-words text-text-secondary">{item.previewDescription}</p> : null}
    {item.noteContent ? <section aria-label="Link notes" className="border-t border-border-control pt-4"><p className="mb-3 flex items-center gap-2 text-xs font-medium text-text-secondary"><NoteIcon className="size-4" />Notes</p><NoteContent className="library-preview-document" content={item.noteContent} format={item.noteFormat ?? "plain"} /></section> : null}
  </div>;
  return item.previewAssetId ? <div className="flex h-full min-h-0 flex-col gap-4 px-4 pb-4">
    <div className="grid min-h-0 min-w-0 flex-1 place-items-center" data-preview-media>
      <LibraryItemMedia item={item} variant="preview" />
    </div>
    <ScrollPanel className="flex max-h-[35%] shrink-0 flex-col" viewportClassName="scroll-fade min-h-0 flex-1 overscroll-contain" viewportProps={{ "data-preview-scroll": "", tabIndex: 0, role: "region", "aria-label": "Link details" }}>{details}</ScrollPanel>
  </div> : <ScrollPanel className="h-full min-h-0" viewportClassName="scroll-fade overscroll-contain px-4" contentClassName="!flex min-h-full" viewportProps={{ "data-preview-scroll": "", tabIndex: 0 }}><div className="m-auto w-full shrink-0 pb-4">{details}</div></ScrollPanel>;
}

function ImagePreview({ item, onGalleryStep }: { item: Extract<Item, { type: "image" }>; onGalleryStep: () => void }) {
  const [slide, setSlide] = useState(0);
  const [imageSizing, setImageSizing] = useState<"fit" | "scroll">("fit");
  return <div className="media-viewer-frame flex h-full min-h-0 flex-col gap-4 px-4 pb-4">
    <MediaViewerToolbar view={<SegmentedControl label="Image sizing" value={imageSizing} onChange={setImageSizing} className="w-40"
      choices={[{ value: "fit", label: "Fit", ariaLabel: "Fit image" }, { value: "scroll", label: "Scroll", ariaLabel: "Scroll image" }]} />}
      navigation={item.assetIds.length === 1 ? null : <div className="flex items-center justify-center gap-1.5">
        <button type="button" className="ui-control flex size-[var(--viewer-control-size,2.75rem)] shrink-0 items-center justify-center disabled:opacity-40" aria-label="Previous gallery image" title="Previous gallery image" disabled={slide === 0} onClick={() => { onGalleryStep(); setSlide(slide - 1); }}><ArrowLeftIcon className="size-4 rtl:rotate-180" /></button>
        <span className="whitespace-nowrap text-xs tabular-nums text-text-secondary"><span className="sr-only">Image </span>{slide + 1} of {item.assetIds.length}</span>
        <button type="button" className="ui-control flex size-[var(--viewer-control-size,2.75rem)] shrink-0 items-center justify-center disabled:opacity-40" aria-label="Next gallery image" title="Next gallery image" disabled={slide >= item.assetIds.length - 1} onClick={() => { onGalleryStep(); setSlide(slide + 1); }}><ArrowRightIcon className="size-4 rtl:rotate-180" /></button>
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
  const [ready, setReady] = useState(false);
  const poster = useThumbnailObjectUrl(assetId);
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
  return <div className="preview-video-frame">
    <div role={ready ? undefined : "status"} aria-label={ready ? undefined : "Loading video"} aria-hidden={ready || undefined} data-ready={ready} className="preview-video-loading"><span className="sr-only">Loading video…</span><span aria-hidden="true" /></div>
    {media.url ? <video controls playsInline preload="metadata" src={media.url} poster={poster ?? undefined} aria-label={title}
      data-ready={ready} className="preview-video-media block h-auto w-auto max-h-full max-w-full rounded-input object-contain"
      onLoadedMetadata={() => setReady(true)} onError={() => setMedia({ url: null, error: true })} /> : null}
  </div>;
}
