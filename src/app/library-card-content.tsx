"use client";

import { useId, useRef, useState } from "react";
import { itemListTitle, type Item } from "@/domain/item";
import { imageCardSecondary, linkCardHost, linkFaviconUrl } from "@/domain/card-display";
import { ItemTagChips } from "./item-tag-chips";
import { CollectionIcon, LinkIcon, NoteIcon } from "./shell-icons";

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

export function LibraryCardMetadata({ collections, tags, mutationBusy, onBrowseTag, onRemoveTag }: {
  collections: string[];
  tags: { id: string; name: string }[];
  mutationBusy: boolean;
  onBrowseTag: (id: string) => void;
  onRemoveTag: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  if (!collections.length && !tags.length) return null;
  return (
    <div className="mt-1 text-xs text-text-secondary">
      <div className="flex min-h-10 items-center justify-between gap-2">
        {collections.length ? <ul aria-label="Collections" className="min-w-0 flex-1">
          {collections.map(name => <li key={name} className="flex min-w-0 items-center gap-1.5"><CollectionIcon className="size-4" /><span className="truncate" title={name}>{name}</span></li>)}
        </ul> : <span />}
        {tags.length ? <button ref={triggerRef} type="button" aria-expanded={expanded} aria-controls={id} className="min-h-10 shrink-0 rounded-control px-1 hover:text-text-primary" onClick={() => setExpanded(!expanded)}>{tags.length} {tags.length === 1 ? "tag" : "tags"}</button> : null}
      </div>
      {tags.length ? (
        <div
          id={id}
          hidden={!expanded}
          onKeyDown={event => {
            if (event.key === "Escape") {
              setExpanded(false);
              triggerRef.current?.focus();
            }
          }}
        >
          <ItemTagChips
            tags={tags}
            mutationBusy={mutationBusy}
            onBrowseTag={onBrowseTag}
            onRemoveTag={onRemoveTag}
            className="flex flex-wrap gap-2 pb-2"
          />
        </div>
      ) : null}
    </div>
  );
}
