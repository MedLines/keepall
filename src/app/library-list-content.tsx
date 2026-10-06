"use client";

import Link from "next/link";
import { SearchHighlight, SearchResult } from "./search-highlight";
import type { SearchExcerpt } from "@/domain/search";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { cardSecondaryLine } from "@/domain/card-display";
import { itemListTitle, type Item } from "@/domain/item";
import { CollectionIcon, PinIcon } from "./shell-icons";
import { CardNote, CardSource } from "./library-card-details";

const TAG_GAP_PX = 4;

export function countFittingTags(
  tagWidths: number[],
  availableWidth: number,
  overflowWidth: number,
) {
  if (tagWidths.length <= 1) {
    return tagWidths.length;
  }

  const fullWidth = tagWidths.reduce((total, width) => total + width, 0) + TAG_GAP_PX * (tagWidths.length - 1);
  if (fullWidth <= availableWidth) {
    return tagWidths.length;
  }

  const maxTagWidth = Math.max(0, availableWidth - overflowWidth - TAG_GAP_PX);
  let usedWidth = overflowWidth;
  let count = 0;
  for (const measuredWidth of tagWidths) {
    const width = Math.min(measuredWidth, maxTagWidth);
    const nextWidth = usedWidth + TAG_GAP_PX + width;
    if (nextWidth > availableWidth) break;
    usedWidth = nextWidth;
    count += 1;
  }
  return count;
}

export function LibraryListContent({ item, pinned, onOpen, openHref, query = "", tagNames = [], searchExcerpt }: {
  item: Item;
  pinned: boolean;
  onOpen: () => void;
  openHref?: string;
  query?: string;
  tagNames?: readonly string[];
  searchExcerpt?: SearchExcerpt;
}) {
  const title = item.type === "link" && !item.title.trim() && !item.previewTitle.trim()
    ? item.url.replace(/^https?:\/\//, "")
    : item.type === "image" ? item.title.trim() : itemListTitle(item);
  const secondary = item.type === "link" || item.type === "image" ? "" : cardSecondaryLine(item);
  const sourceUrl = item.type === "link" ? item.url : item.type === "image" ? item.sourceUrl : "";
  const personalNote = item.type === "image" ? { content: item.caption, format: item.captionFormat }
    : item.type === "link" ? { content: item.noteContent ?? "", format: item.noteFormat } : null;
  const hasContent = Boolean(title || secondary || pinned || (item.type === "image" && item.assetIds.length > 1));
  const content = (
    <>
      {title || pinned ? <span className="flex min-w-0 items-center gap-2">
        {pinned ? <span title="Pinned in this collection"><PinIcon className="size-4" /><span className="sr-only">Pinned in this collection</span></span> : null}
        {title ? <span className="truncate text-base font-medium" title={title}><SearchHighlight text={title} query={query} /></span> : null}
      </span> : null}
      {item.type === "link" && item.previewDescription ? <span className="library-card-description mt-1 block truncate"><SearchHighlight text={item.previewDescription} query={query} /></span> : secondary ? (
        <span className="mt-1 block truncate text-xs text-text-secondary"><SearchHighlight text={secondary} query={query} /></span>
      ) : item.type === "note" ? <span className="mt-1 block text-xs text-text-secondary">Note</span> : item.type === "image" && item.assetIds.length > 1 ? <span className="mt-1 block text-xs text-text-secondary">{item.assetIds.length} images</span> : null}
    </>
  );
  return (
    <SearchResult item={item} query={query} tagNames={tagNames} excerpt={searchExcerpt}>
      {hasContent ? item.deletedAt !== undefined ? <div className="min-w-0">{content}</div> : item.type === "link" ? (
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${itemListTitle(item)}`}
          className="block min-h-11 w-full min-w-0 rounded-sm text-start"
        >
          {content}
        </a>
      ) : (item.type === "note" || item.type === "document") && openHref ? (
        <Link href={openHref} prefetch={false} aria-label={`Open ${itemListTitle(item)}`} className="block min-h-11 w-full min-w-0 rounded-sm text-start">{content}</Link>
      ) : (
        <button type="button" onClick={onOpen} aria-label={`Open ${itemListTitle(item)}`} className="block min-h-11 w-full min-w-0 rounded-sm text-start">
          {content}
        </button>
      ) : null}
      {sourceUrl ? <div className="mt-1"><CardSource url={sourceUrl} query={query} /></div> : null}
      {personalNote?.content.trim() ? <div className="mt-2"><CardNote {...personalNote} title={itemListTitle(item)} openHref={openHref} onOpen={onOpen} readOnly={item.deletedAt !== undefined} query={query} /></div> : null}
      <time className="library-list-date text-xs text-text-secondary" dateTime={new Date(item.createdAt).toISOString()} title="Saved date">
        {new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
      </time>
    </SearchResult>
  );
}

export function LibraryListMetadata({ collections, tags, onBrowseCollection, onBrowseTag }: {
  collections: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  onBrowseCollection: (id: string) => void;
  onBrowseTag: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(Math.min(2, tags.length));
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tagRowRef = useRef<HTMLDivElement>(null);
  const tagMeasureRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const overflowMeasureRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = tagRowRef.current;
    if (!container) return;

    const measure = () => {
      const availableWidth = container.clientWidth;
      if (availableWidth <= 0) return;
      const tagWidths = tagMeasureRefs.current
        .slice(0, tags.length)
        .map(node => node?.getBoundingClientRect().width ?? 0);
      const overflowWidth = overflowMeasureRef.current?.getBoundingClientRect().width ?? 0;
      setVisibleCount(countFittingTags(tagWidths, availableWidth, overflowWidth));
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [tags]);

  if (!collections.length && !tags.length) return null;
  const visibleTags = expanded ? tags : tags.slice(0, visibleCount);
  const hiddenCount = tags.length - visibleCount;
  const hasOverflow = hiddenCount > 0;
  return (
    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
      {collections.length ? <ul aria-label="Collections" className="flex min-w-0 flex-wrap gap-1">
        {collections.map(collection => <li key={collection.id} className="min-w-0 max-w-full">
          <button type="button" className="library-card-metadata-pill max-w-full" title={collection.name} onClick={() => onBrowseCollection(collection.id)}><CollectionIcon className="size-4 shrink-0" /><span className="truncate">{collection.name}</span></button>
        </li>)}
      </ul> : null}
      {tags.length ? (
        <div ref={tagRowRef} className="relative flex min-w-0 flex-1 basis-48 items-start gap-1">
          <div aria-hidden className="pointer-events-none absolute invisible flex items-center gap-1 whitespace-nowrap">
            {tags.map((tag, index) => <span key={tag.id} ref={node => { tagMeasureRefs.current[index] = node; }} className="library-card-metadata-pill">{tag.name}</span>)}
            <span ref={overflowMeasureRef} className="inline-flex min-h-8 items-center rounded-md px-2">+{tags.length}</span>
          </div>
          <ul id={id} aria-label="Tags" className={`flex min-w-0 flex-1 gap-1 ${expanded ? "flex-wrap" : "overflow-hidden"}`} onKeyDown={event => {
            if (event.key === "Escape" && expanded) {
              setExpanded(false);
              triggerRef.current?.focus();
            }
          }}>
            {visibleTags.map(tag => <li key={tag.id} className="min-w-0 max-w-full shrink-0">
              <button type="button" title={tag.name} className="library-card-metadata-pill max-w-full" onClick={() => onBrowseTag(tag.id)}><span className="truncate">{tag.name}</span></button>
            </li>)}
          </ul>
          {expanded || hasOverflow ? <button ref={triggerRef} type="button" aria-controls={id} aria-expanded={expanded} aria-label={expanded ? "Show fewer tags" : `Show ${hiddenCount} more tags`} className="min-h-8 shrink-0 rounded-md px-2 hover:bg-bg-raised hover:text-text-primary" onClick={() => setExpanded(!expanded)}>{expanded ? "Less" : `+${hiddenCount}`}</button> : null}
        </div>
      ) : null}
    </div>
  );
}
