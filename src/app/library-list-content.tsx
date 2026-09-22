"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { cardSecondaryLine, linkCardHost } from "@/domain/card-display";
import { itemListTitle, type Item } from "@/domain/item";
import type { LinkItem } from "@/domain/link";
import { LinkIcon, PinIcon } from "./shell-icons";

function LinkContext({ item }: { item: LinkItem }) {
  return (
    <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-text-secondary">
      <LinkIcon className="size-6" />
      <span className="truncate">{linkCardHost(item)}{item.previewDescription ? ` · ${item.previewDescription}` : ""}</span>
    </span>
  );
}

export function LibraryListContent({ item, pinned, onOpen, openHref }: {
  item: Item;
  pinned: boolean;
  onOpen: () => void;
  openHref?: string;
}) {
  const title = item.type === "link" && !item.title.trim() && !item.previewTitle.trim()
    ? item.url.replace(/^https?:\/\//, "")
    : item.type === "image" ? item.title.trim() : itemListTitle(item);
  const secondary = cardSecondaryLine(item);
  const hasContent = Boolean(title || secondary || pinned || (item.type === "image" && item.assetIds.length > 1));
  const content = (
    <>
      {title || pinned ? <span className="flex min-w-0 items-center gap-2">
        {pinned ? <span title="Pinned in this collection"><PinIcon className="size-4" /><span className="sr-only">Pinned in this collection</span></span> : null}
        {title ? <span className="truncate text-base font-medium" title={title}>{title}</span> : null}
      </span> : null}
      {item.type === "link" ? <LinkContext key={item.url} item={item} /> : secondary ? (
        <span className="mt-1 block truncate text-xs text-text-secondary">{secondary}</span>
      ) : item.type === "note" ? <span className="mt-1 block text-xs text-text-secondary">Note</span> : item.assetIds.length > 1 ? <span className="mt-1 block text-xs text-text-secondary">{item.assetIds.length} images</span> : null}
    </>
  );
  return (
    <>
      {hasContent ? item.type === "link" ? (
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${itemListTitle(item)}`}
          className="block min-h-11 w-full min-w-0 rounded-sm text-start"
        >
          {content}
        </a>
      ) : item.type === "note" && openHref ? (
        <Link href={openHref} prefetch={false} aria-label={`Open ${itemListTitle(item)}`} className="block min-h-11 w-full min-w-0 rounded-sm text-start">{content}</Link>
      ) : (
        <button type="button" onClick={onOpen} aria-label={`Open ${itemListTitle(item)}`} className="block min-h-11 w-full min-w-0 rounded-sm text-start">
          {content}
        </button>
      ) : null}
      {item.type === "link" && item.noteContent?.trim() ? (
        <button type="button" onClick={onOpen} className="shrink-0 rounded-control-sm px-2 py-1 text-xs font-medium text-text-secondary hover:text-text-primary">
          My note
        </button>
      ) : null}
      <time className="library-list-date text-xs text-text-secondary" dateTime={new Date(item.createdAt).toISOString()} title="Saved date">
        {new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
      </time>
    </>
  );
}

export function LibraryListMetadata({ collections, tags, onBrowseCollection, onBrowseTag }: {
  collections: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  onBrowseCollection: (id: string) => void;
  onBrowseTag: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  if (!collections.length && !tags.length) return null;
  const visibleTags = expanded ? tags : tags.slice(0, 2);
  return (
    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
      {collections.length ? <ul aria-label="Collections" className="flex min-w-0 flex-wrap gap-1">
        {collections.map(collection => <li key={collection.id} className="min-w-0 max-w-full">
          <button type="button" className="block min-h-8 max-w-full truncate rounded-md px-2 text-start hover:bg-bg-raised hover:text-text-primary" title={collection.name} onClick={() => onBrowseCollection(collection.id)}>in {collection.name}</button>
        </li>)}
      </ul> : null}
      {tags.length ? <ul id={id} aria-label="Tags" className="flex min-w-0 flex-wrap gap-1" onKeyDown={event => {
        if (event.key === "Escape" && expanded) {
          setExpanded(false);
          triggerRef.current?.focus();
        }
      }}>
        {visibleTags.map(tag => <li key={tag.id} className="min-w-0 max-w-full">
          <button type="button" title={tag.name} className="block min-h-8 max-w-full truncate rounded-md bg-bg-raised px-2 text-start hover:text-text-primary" onClick={() => onBrowseTag(tag.id)}>{tag.name}</button>
        </li>)}
      </ul> : null}
      {tags.length > 2 ? <button ref={triggerRef} type="button" aria-controls={id} aria-expanded={expanded} aria-label={expanded ? "Show fewer tags" : `Show ${tags.length - 2} more tags`} className="min-h-8 rounded-md px-2 hover:bg-bg-raised hover:text-text-primary" onClick={() => setExpanded(!expanded)}>{expanded ? "Less" : `+${tags.length - 2}`}</button> : null}
    </div>
  );
}
