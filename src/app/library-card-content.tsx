"use client";

import { useEffect, useId, useRef, useState } from "react";
import { itemListTitle, type Item } from "@/domain/item";
import { imageCardSecondary, linkCardHost, linkFaviconUrl } from "@/domain/card-display";
import { CloseIcon, CollectionIcon, LinkIcon, NoteIcon } from "./shell-icons";

function LinkSource({ url, host }: { url: string; host: string }) {
  const [broken, setBroken] = useState(false);
  const favicon = linkFaviconUrl(url, { size: 32 });
  return (
    <div className="mb-1 flex min-w-0 items-center gap-1.5 pr-9 text-xs text-text-secondary">
      {favicon && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- small remote site favicon
        <img src={favicon} alt="" className="size-4 shrink-0 rounded-sm" onError={() => setBroken(true)} />
      ) : <LinkIcon className="size-4" />}
      <span className="truncate">{host}</span>
    </div>
  );
}

export function LibraryCardContent({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const title = item.type === "link" && !item.title.trim() && !item.previewTitle.trim()
    ? item.url.replace(/^https?:\/\//, "")
    : itemListTitle(item);
  const description = item.type === "link" ? item.previewDescription : item.type === "image" ? imageCardSecondary(item) : "";
  return (
    <div className="min-w-0">
      {item.type === "note" ? <div className="mb-3 flex items-center gap-1.5 text-xs text-text-secondary"><NoteIcon className="size-4" />Note</div> : null}
      {item.type === "link" ? <LinkSource key={item.url} url={item.url} host={linkCardHost(item)} /> : null}
      <h2 className={item.type === "note" ? "text-[17px] font-medium leading-snug" : "text-sm font-medium leading-snug"}>
        {item.type === "link" ? (
          <a href={item.url} target="_blank" rel="noreferrer" title={title} className="line-clamp-2 break-words underline-offset-2 hover:underline">{title}</a>
        ) : (
          <button type="button" onClick={onOpen} title={title} className={`${item.type === "image" ? "truncate" : "line-clamp-2 break-words"} w-full text-left underline-offset-2 hover:underline`}>{title}</button>
        )}
      </h2>
      {item.type === "note" ? (
        <>
          <button type="button" onClick={onOpen} aria-label={`Read ${title}`} className="mt-3 line-clamp-6 w-full whitespace-pre-line break-words text-left text-sm leading-relaxed text-text-secondary">{item.content.trim()}</button>
          <p className="mt-3 text-xs text-text-secondary">Edited <time dateTime={new Date(item.updatedAt).toISOString()}>{new Date(item.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time></p>
        </>
      ) : description ? <p className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-text-secondary">{description}</p> : null}
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
          <button ref={triggerRef} type="button" aria-expanded={expanded} aria-controls={id} className="min-h-8 rounded-control bg-bg-raised px-2 text-text-primary transition-[background-color,color,scale] duration-150 ease-out hover:bg-bg-canvas active:scale-[0.96] motion-reduce:transition-[background-color,color] motion-reduce:active:scale-100" onClick={() => {
            setExpanded(!expanded);
            setPendingRemoveId(null);
          }}>{tags.length} {tags.length === 1 ? "tag" : "tags"}</button>
          {expanded ? <div id={id} className="absolute right-0 top-[calc(100%+4px)] z-40 min-w-40 rounded-control border border-border-edge bg-bg-surface p-1.5 shadow-menu">
            <ul aria-label="Tags" className="flex min-w-0 flex-col gap-1">
              {tags.map(tag => {
                const confirming = pendingRemoveId === tag.id;
                return <li key={tag.id} className="flex min-w-0 items-center rounded-md hover:bg-bg-raised">
                  <button type="button" title={tag.name} className="min-h-9 min-w-0 flex-1 truncate rounded-md px-2 text-start text-sm text-text-primary" onClick={() => {
                    setExpanded(false);
                    setPendingRemoveId(null);
                    onBrowseTag(tag.id);
                  }}>{tag.name}</button>
                  {confirming ? <button type="button" aria-label={`Confirm remove tag ${tag.name}`} className="min-h-8 shrink-0 rounded-md bg-bg-danger px-2 text-xs font-medium text-text-danger transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100" onClick={() => {
                    onRemoveTag(tag.id);
                    setPendingRemoveId(null);
                  }}>Remove</button> : <button type="button" title={`Remove ${tag.name}`} aria-label={`Remove tag ${tag.name}`} className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-bg-danger hover:text-text-danger" onClick={() => setPendingRemoveId(tag.id)}><CloseIcon /></button>}
                </li>;
              })}
            </ul>
          </div> : null}
        </div> : null}
      </div>
    </div>
  );
}
