"use client";

import { useEffect, useId, useRef, useState } from "react";
import { itemListTitle, type Item } from "@/domain/item";
import { imageCardSecondary, linkCardHost, linkFaviconUrl } from "@/domain/card-display";
import { CloseIcon, CollectionIcon, HashIcon, LinkIcon, NoteIcon, PinIcon } from "./shell-icons";

function LinkSource({ url, host }: { url: string; host: string }) {
  const [broken, setBroken] = useState(false);
  const favicon = linkFaviconUrl(url, { size: 32 });
  return (
    <div className="mb-3 flex min-w-0 items-center gap-2 pr-9 text-xs text-text-secondary">
      {favicon && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- small remote site favicon
        <img src={favicon} alt="" className="size-4 shrink-0 rounded-sm" onError={() => setBroken(true)} />
      ) : <LinkIcon className="size-4" />}
      <span className="truncate">{host}</span>
    </div>
  );
}

export function LibraryCardContent({ item, onOpen, pinned = false }: {
  item: Item;
  onOpen: () => void;
  pinned?: boolean;
}) {
  const title = item.type === "link" && !item.title.trim() && !item.previewTitle.trim()
    ? item.url.replace(/^https?:\/\//, "")
    : item.type === "image" ? item.title.trim() : itemListTitle(item);
  const description = item.type === "link" ? item.previewDescription : item.type === "image" ? imageCardSecondary(item) : "";
  if (item.type === "image" && !title && !description && !pinned) return null;
  const TitleRow = title ? "h2" : "div";
  return (
    <div className="min-w-0">
      {item.type === "note" ? <div className="mb-3 flex items-center gap-1.5 text-xs text-text-secondary"><NoteIcon className="size-4" />Note</div> : null}
      {item.type === "link" ? <LinkSource key={item.url} url={item.url} host={linkCardHost(item)} /> : null}
      {title || pinned ? <TitleRow className={`flex min-w-0 items-start gap-1.5 leading-snug ${item.type === "note" ? "text-[23px] font-semibold" : item.type === "link" ? "text-xl font-semibold" : "text-sm font-medium"}`}>
        {pinned ? (
          <span
            title="Pinned in this collection"
            className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-text-secondary"
          >
            <PinIcon className="size-4" />
            <span className="sr-only">Pinned in this collection</span>
          </span>
        ) : null}
        {item.type === "link" ? (
          <a href={item.url} target="_blank" rel="noreferrer" title={title} className="min-w-0 flex-1 line-clamp-2 break-words underline-offset-2 hover:underline">{title}</a>
        ) : title ? (
          <button type="button" onClick={onOpen} title={title} className={`${item.type === "image" ? "truncate" : "line-clamp-2 break-words"} min-w-0 flex-1 text-left underline-offset-2 hover:underline`}>{title}</button>
        ) : null}
      </TitleRow> : null}
      {item.type === "note" ? (
        <>
          <button type="button" onClick={onOpen} aria-label={`Read ${title}`} className="mt-3 line-clamp-6 w-full whitespace-pre-line break-words text-left text-base leading-relaxed text-text-primary">{item.content.trim()}</button>
          <p className="mt-3 text-xs text-text-secondary">Edited <time dateTime={new Date(item.updatedAt).toISOString()}>{new Date(item.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time></p>
        </>
      ) : description ? <p className="mt-2 line-clamp-2 break-words text-sm leading-relaxed text-text-secondary">{description}</p> : null}
    </div>
  );
}

export function LibraryCardMetadata({ collections, tags, onBrowseCollection, onBrowseTag, onRemoveTag }: {
  collections: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  onBrowseCollection: (id: string) => void;
  onBrowseTag: (id: string) => void;
  onRemoveTag: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!expanded) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setExpanded(false);
        setPendingRemoveId(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setExpanded(false);
        setPendingRemoveId(null);
        triggerRef.current?.focus();
      }
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

  if (!collections.length && !tags.length) return null;
  return (
    <div className="mt-1 text-xs text-text-secondary">
      <div className="flex min-h-8 items-center justify-between gap-2">
        {collections.length ? <ul aria-label="Collections" className="min-w-0 flex-1">
          {collections.map(collection => <li key={collection.id} className="min-w-0">
            <button type="button" className="flex min-h-8 max-w-full items-center gap-1.5 rounded-md px-1.5 text-left hover:bg-bg-raised hover:text-text-primary" title={collection.name} onClick={() => onBrowseCollection(collection.id)}>
              <CollectionIcon className="size-4 shrink-0" />
              <span className="truncate">{collection.name}</span>
            </button>
          </li>)}
        </ul> : <span />}
        {tags.length ? <div ref={rootRef} className="library-card-tag-control relative shrink-0" data-open={expanded || undefined}>
          <button ref={triggerRef} type="button" aria-expanded={expanded} aria-controls={id} className="squircle-panel flex min-h-8 items-center gap-1.5 rounded-control bg-bg-raised px-2 text-text-secondary hover:text-text-primary active:scale-[0.96] motion-reduce:active:scale-100" onClick={() => {
            setExpanded(!expanded);
            setPendingRemoveId(null);
          }}><HashIcon className="size-3.5" />{tags.length} {tags.length === 1 ? "tag" : "tags"}</button>
          {expanded ? <div id={id} className="ui-popover absolute right-0 top-[calc(100%+8px)] z-40 w-64 max-w-[calc(100vw-6rem)]">
            <ul aria-label="Tags" className="flex min-w-0 flex-col gap-1">
              {tags.map(tag => {
                const confirming = pendingRemoveId === tag.id;
                return <li key={tag.id} className="squircle-panel flex min-w-0 items-center rounded-control-sm hover:bg-bg-active focus-within:bg-bg-active">
                  <button type="button" title={tag.name} className="ui-menu-item min-w-0 flex-1 truncate text-start text-sm text-text-primary hover:bg-transparent" onClick={() => {
                    setExpanded(false);
                    setPendingRemoveId(null);
                    onBrowseTag(tag.id);
                  }}>{tag.name}</button>
                  {confirming ? <button type="button" aria-label={`Confirm remove tag ${tag.name}`} className="min-h-8 shrink-0 rounded-md bg-bg-danger px-2 text-xs font-medium text-text-danger transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100" onClick={() => {
                    onRemoveTag(tag.id);
                    setPendingRemoveId(null);
                  }}>Remove</button> : <button type="button" title={`Remove ${tag.name}`} aria-label={`Remove tag ${tag.name}`} className="squircle-panel flex size-10 shrink-0 items-center justify-center rounded-control-sm text-text-secondary hover:bg-bg-danger hover:text-text-danger focus-visible:bg-bg-danger focus-visible:text-text-danger" onClick={() => setPendingRemoveId(tag.id)}><CloseIcon /></button>}
                </li>;
              })}
            </ul>
          </div> : null}
        </div> : null}
      </div>
    </div>
  );
}
