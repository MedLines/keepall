"use client";

import { useId, useRef, useState } from "react";
import { cardSecondaryLine, linkCardHost, linkFaviconUrl } from "@/domain/card-display";
import { itemListTitle, type Item } from "@/domain/item";
import type { LinkItem } from "@/domain/link";
import { LinkIcon, PinIcon } from "./shell-icons";

function LinkContext({ item }: { item: LinkItem }) {
  const [broken, setBroken] = useState(false);
  const favicon = linkFaviconUrl(item.url, { size: 32 });
  return (
    <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-text-secondary">
      {favicon && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- small remote site favicon
        <img src={favicon} alt="" className="size-4 shrink-0 rounded-sm" onError={() => setBroken(true)} />
      ) : <LinkIcon className="size-4" />}
      <span className="truncate">{linkCardHost(item)}{item.previewDescription ? ` · ${item.previewDescription}` : ""}</span>
    </span>
  );
}

export function LibraryListContent({ item, pinned, onOpen }: {
  item: Item;
  pinned: boolean;
  onOpen: () => void;
}) {
  const title = item.type === "link" && !item.title.trim() && !item.previewTitle.trim()
    ? item.url.replace(/^https?:\/\//, "")
    : itemListTitle(item);
  const secondary = cardSecondaryLine(item);
  return (
    <>
      <button type="button" onClick={onOpen} aria-label={`Open ${itemListTitle(item)}`} className="block min-h-11 w-full min-w-0 rounded-sm text-start">
        <span className="flex min-w-0 items-center gap-2">
          {pinned ? <span title="Pinned in this collection"><PinIcon className="size-4" /><span className="sr-only">Pinned in this collection</span></span> : null}
          <span className="truncate text-base font-medium" title={title}>{title}</span>
        </span>
        {item.type === "link" ? <LinkContext key={item.url} item={item} /> : secondary ? (
          <span className="mt-1 block truncate text-xs text-text-secondary">{secondary}</span>
        ) : <span className="mt-1 block text-xs text-text-secondary">{item.type === "note" ? "Note" : "Image"}{item.type === "image" && item.assetIds.length > 1 ? ` · ${item.assetIds.length} images` : ""}</span>}
      </button>
      <time className="library-list-date text-xs text-text-secondary" dateTime={new Date(item.createdAt).toISOString()} title="Saved date">
        {new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
      </time>
    </>
  );
}

export function LibraryListMetadata({ collections, tags, onBrowseTag }: {
  collections: string[];
  tags: { id: string; name: string }[];
  onBrowseTag: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  if (!collections.length && !tags.length) return null;
  const visibleTags = expanded ? tags : tags.slice(0, 2);
  return (
    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
      {collections.length ? <span aria-label="Collections" className="min-w-0 truncate" title={collections.join(", ")}>in {collections.join(", ")}</span> : null}
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
