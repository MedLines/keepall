"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip } from "@base-ui/react/tooltip";

import { SearchHighlight, SearchResult } from "./search-highlight";
import type { SearchExcerpt } from "@/domain/search";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { itemListTitle, type Item } from "@/domain/item";
import { imageCardSecondary } from "@/domain/card-display";
import { noteReadingBody } from "@/domain/note";
import { CloseIcon, CollectionIcon, HashIcon } from "./shell-icons";
import { LibraryDocumentCard } from "./library-document-card";
import { LibraryReadingCard } from "./library-reading-card";
import { CardNote, CardPin, CardSource } from "./library-card-details";
import { SHELL_TOOLTIP } from "./shell-styles";

function TagPopover({ id, tags, onBrowseTag, onRemoveTag }: {
  id: string;
  tags: { id: string; name: string }[];
  onBrowseTag: (id: string) => void;
  onRemoveTag: (id: string) => void;
}) {
  const isPresent = useIsPresent();
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      id={id}
      className="library-tag-popover ui-popover flex flex-col overflow-hidden absolute end-0 top-[calc(100%+8px)] z-40 max-h-[min(20rem,50dvh)] w-48 max-w-[calc(100vw-6rem)]"
      style={{ pointerEvents: isPresent ? "auto" : "none" }}
      inert={!isPresent}
      aria-hidden={!isPresent}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0, scale: 0.95, transition: { duration: 0.1, ease: [0.2, 0, 0, 1] } }}
      transition={{ duration: reduceMotion ? 0 : 0.15, ease: [0.2, 0, 0, 1] }}
    >
      <ScrollArea className="flex min-h-0 flex-col" viewportClassName="min-h-0 flex-1">
      <ul aria-label="Tags" className="flex min-w-0 flex-col gap-1">
        {tags.map(tag => {
          return <li key={tag.id} className="library-tag-row squircle-panel flex min-w-0 items-center rounded-control-sm hover:bg-bg-active focus-within:bg-bg-active">
            <button type="button" className="ui-menu-item min-w-0 flex-1 truncate text-start text-sm text-text-primary hover:bg-transparent" onClick={() => onBrowseTag(tag.id)}>{tag.name}</button>
            <button type="button" aria-label={`Remove tag ${tag.name}`} className="library-tag-remove squircle-panel flex size-7 shrink-0 items-center justify-center rounded-control-sm text-text-secondary hover:bg-bg-danger hover:text-text-danger focus-visible:bg-bg-danger focus-visible:text-text-danger" onClick={() => onRemoveTag(tag.id)}><CloseIcon className="size-4" /></button>
          </li>;
        })}
      </ul>
      </ScrollArea>
    </motion.div>
  );
}

export function LibraryCardContent({ item, onOpen, openHref, pinned = false, query = "", tagNames = [], searchExcerpt }: {
  item: Item;
  onOpen: () => void;
  openHref?: string;
  pinned?: boolean;
  query?: string;
  tagNames?: readonly string[];
  searchExcerpt?: SearchExcerpt;
}) {
  const readOnly = item.deletedAt !== undefined;
  const wrap = (content: ReactNode) => <SearchResult item={item} query={query} tagNames={tagNames} excerpt={searchExcerpt}>{content}</SearchResult>;
  if (item.type === "document") {
    return wrap(<LibraryDocumentCard item={item} query={query} pinned={pinned} openHref={openHref} onOpen={onOpen} />);
  }
  if (item.type === "note") {
    return wrap(<LibraryReadingCard item={item} text={noteReadingBody(item) || item.content} query={query} pinned={pinned} openHref={openHref} onOpen={onOpen} />);
  }
  const title = item.type === "link" && !item.title.trim() && !item.previewTitle.trim()
    ? item.url.replace(/^https?:\/\//, "")
    : item.type === "image" ? item.title.trim() : itemListTitle(item);
  if (item.type === "image" && !title && !imageCardSecondary(item) && !pinned) return query.trim() ? wrap(null) : null;
  const TitleRow = title ? "h2" : "div";
  const hasLinkImage = item.type === "link" && Boolean(item.previewAssetId);
  return wrap(
    <div className="library-card-copy">
      {title || pinned ? <TitleRow className={`library-card-title ${item.type === "link" && !hasLinkImage ? "library-card-title-fallback" : ""}`}>
        {pinned ? <CardPin /> : null}
        {item.type === "link" ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="library-card-title-action library-card-hit-area"><span><SearchHighlight text={title} query={query} /></span></a>
          : readOnly ? <span className="min-w-0 flex-1 truncate"><SearchHighlight text={title} query={query} /></span> : title ? <button type="button" onClick={onOpen} className="library-card-title-action library-card-hit-area"><span><SearchHighlight text={title} query={query} /></span></button> : null}
      </TitleRow> : null}
      {item.type === "link" && item.previewDescription ? <p className={`library-card-description ${hasLinkImage ? "line-clamp-1" : "line-clamp-2"}`}><SearchHighlight text={item.previewDescription} query={query} /></p> : null}
      {item.type === "link" ? <CardSource url={item.url} query={query} /> : item.type === "image" && item.sourceUrl ? <CardSource url={item.sourceUrl} query={query} /> : null}
      {item.type === "link" ? <CardNote content={item.noteContent ?? ""} format={item.noteFormat} title={itemListTitle(item)} openHref={openHref} onOpen={onOpen} readOnly={readOnly} query={query} />
        : item.type === "image" ? <CardNote content={item.caption} format={item.captionFormat} title={itemListTitle(item)} openHref={openHref} onOpen={onOpen} readOnly={readOnly} query={query} /> : null}
    </div>
  );
}

export function LibraryCardMetadata({ collections, tags, onBrowseCollection, onBrowseTag, onRemoveTag, className = "" }: {
  collections: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  onBrowseCollection: (id: string) => void;
  onBrowseTag: (id: string) => void;
  onRemoveTag: (id: string) => void;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!expanded) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setExpanded(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setExpanded(false);
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
    <div className={`library-card-metadata text-xs text-text-secondary ${className}`}>
      <div className="flex min-h-8 items-center justify-between gap-2">
        {collections.length ? <ul aria-label="Collections" className="min-w-0 flex-1">
          {collections.map(collection => <li key={collection.id} className="min-w-0"><Tooltip.Root>
            <Tooltip.Trigger type="button" delay={100} className="library-card-metadata-pill max-w-full rounded-full" aria-label={collection.name} aria-describedby={`${id}-collection-${collection.id}`} onClick={() => onBrowseCollection(collection.id)}>
              <CollectionIcon className="size-4 shrink-0" />
              <span className="truncate">{collection.name}</span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner side="top" sideOffset={8} className="z-[100]">
                <Tooltip.Popup id={`${id}-collection-${collection.id}`} role="tooltip" className={SHELL_TOOLTIP}>{collection.name}</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
          </li>)}
        </ul> : <span />}
        {tags.length ? <div ref={rootRef} className="library-card-tag-control relative shrink-0">
          <Tooltip.Root disabled={expanded}>
          <Tooltip.Trigger ref={triggerRef} type="button" delay={100} closeDelay={100} aria-label={`${tags.length} ${tags.length === 1 ? "tag" : "tags"}`} aria-describedby={`${id}-tag-preview`} aria-expanded={expanded} aria-controls={id} className="library-card-metadata-pill rounded-full" onClick={() => {
            setExpanded(!expanded);
          }}><HashIcon className="size-4" /><span>{tags.length}<span className="library-card-tag-label"> {tags.length === 1 ? "tag" : "tags"}</span></span></Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner side="top" align="end" sideOffset={8} collisionPadding={8} className="z-[100]">
              <Tooltip.Popup id={`${id}-tag-preview`} role="tooltip" className={`${SHELL_TOOLTIP} max-w-72 whitespace-normal [overflow-wrap:anywhere]`}>{tags.map(tag => tag.name).join(", ")}</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
          </Tooltip.Root>
          <AnimatePresence>
            {expanded ? <TagPopover
              key="tags"
              id={id}
              tags={tags}
              onBrowseTag={(tagId) => {
                setExpanded(false);
                onBrowseTag(tagId);
              }}
              onRemoveTag={onRemoveTag}
            /> : null}
          </AnimatePresence>
        </div> : null}
      </div>
    </div>
  );
}
