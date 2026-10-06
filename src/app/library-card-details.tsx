import Link from "next/link";
import { useState } from "react";
import { linkFaviconUrls, noteCardText } from "@/domain/card-display";
import { DocumentIcon } from "./document-icon";
import { SearchHighlight } from "./search-highlight";
import { ExternalLinkIcon, LinkIcon, NoteIcon, PinIcon } from "./shell-icons";

export function CardPin() {
  return <span title="Pinned in this collection" className="library-card-pin flex size-4 shrink-0 items-center justify-center text-text-secondary"><PinIcon className="size-4" /><span className="sr-only">Pinned in this collection</span></span>;
}

function SourceFavicon({ url }: { url: string }) {
  const [index, setIndex] = useState(0);
  const src = linkFaviconUrls(url, { size: 32 })[index];
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- tiny remote favicons use the existing source fallback chain
    <img src={src} alt="" width={11} height={11} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="size-[1em] shrink-0 object-contain" onError={() => setIndex(previous => previous + 1)} />
  ) : <LinkIcon className="size-[1em] shrink-0" />;
}

export function CardSource({ url, query = "" }: { url: string; query?: string }) {
  let host = url;
  try { host = new URL(url).hostname; } catch { /* Older imports can contain a raw source label. */ }
  return <a href={url} target="_blank" rel="noopener noreferrer" title={url} className="library-card-source library-card-hit-area">
    <span aria-hidden="true" className="library-card-icon-slot"><SourceFavicon key={url} url={url} /></span>
    <span className="truncate"><SearchHighlight text={host} query={query} /></span><ExternalLinkIcon className="size-3 shrink-0" />
  </a>;
}

export function CardNote({ content, format, title, openHref, onOpen, readOnly = false, query = "" }: {
  content: string; format?: "markdown"; title: string; openHref?: string; onOpen: () => void; readOnly?: boolean; query?: string;
}) {
  if (!content.trim()) return null;
  const text = noteCardText({ content: content.slice(0, 600), format });
  const body = <><span role="img" aria-label={format === "markdown" ? "Markdown note" : "Note"} className="library-card-icon-slot">
    {format === "markdown" ? <DocumentIcon format="markdown" className="item-type-icon--markdown size-4" /> : <NoteIcon className="item-type-icon--note size-4" />}
  </span><span className="truncate"><SearchHighlight text={text} query={query} /></span></>;
  const className = "library-attached-note library-card-hit-area";
  return readOnly ? <div className={className}>{body}</div> : openHref ? <Link href={openHref} prefetch={false} aria-label={`Open notes for ${title}`} className={className}>{body}</Link>
    : <button type="button" onClick={onOpen} aria-label={`Open notes for ${title}`} className={className}>{body}</button>;
}
