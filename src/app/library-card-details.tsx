import Link from "next/link";
import { useId, useState, type ReactElement } from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import { linkFaviconUrls, noteCardText } from "@/domain/card-display";
import { DocumentIcon } from "./document-icon";
import { SearchHighlight } from "./search-highlight";
import { ExternalLinkIcon, LinkIcon, NoteIcon, PinIcon } from "./shell-icons";

export function CardPin() {
  return <span role="img" aria-label="Pinned in this collection" className="library-card-pin flex size-4 shrink-0 items-center justify-center text-text-secondary"><PinIcon className="size-4" /><span className="sr-only">Pinned in this collection</span></span>;
}

function SourceFavicon({ url }: { url: string }) {
  const [index, setIndex] = useState(0);
  const src = linkFaviconUrls(url, { size: 32 })[index];
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- tiny remote favicons use the existing source fallback chain
    <img src={src} alt="" width={11} height={11} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="size-[1em] shrink-0 object-contain" onError={() => setIndex(previous => previous + 1)} />
  ) : <LinkIcon className="size-[1em] shrink-0" />;
}

export function CardSource({ url, query = "", showFavicon = true }: { url: string; query?: string; showFavicon?: boolean }) {
  let host = url;
  try { host = new URL(url).hostname; } catch { /* Older imports can contain a raw source label. */ }
  return <a href={url} target="_blank" rel="noopener noreferrer" className="library-card-source library-card-hit-area">
    {showFavicon ? <span aria-hidden="true" className="library-card-icon-slot"><SourceFavicon key={url} url={url} /></span> : null}
    <span className="truncate"><SearchHighlight text={host} query={query} /></span><ExternalLinkIcon className="size-3 shrink-0" />
  </a>;
}

export function CardNote({ content, format, title, openHref, onOpen, readOnly = false, query = "", iconOnly = false }: {
  content: string; format?: "markdown"; title: string; openHref?: string; onOpen: () => void; readOnly?: boolean; query?: string; iconOnly?: boolean;
}) {
  if (!content.trim()) return null;
  const text = noteCardText({ content: content.slice(0, 600), format });
  const body = <><span role="img" aria-label={format === "markdown" ? "Markdown note" : "Note"} className="library-card-icon-slot">
    {format === "markdown" ? <DocumentIcon format="markdown" className="item-type-icon--markdown size-4" /> : <NoteIcon className="item-type-icon--note size-4" />}
  </span>{iconOnly ? null : <span className="truncate"><SearchHighlight text={text} query={query} /></span>}</>;
  const className = `${iconOnly ? "library-attached-note-icon" : "library-attached-note"} library-card-hit-area`;
  const trigger = readOnly ? <div className={className} tabIndex={iconOnly ? 0 : undefined} aria-label={`Notes for ${title}`}>{body}</div> : openHref ? <Link href={openHref} prefetch={false} aria-label={`Open notes for ${title}`} className={className}>{body}</Link>
    : <button type="button" onClick={onOpen} aria-label={`Open notes for ${title}`} className={className}>{body}</button>;
  return iconOnly ? <NoteExcerptTooltip trigger={trigger} text={text} format={format} /> : trigger;
}

function NoteExcerptTooltip({ trigger, text, format }: { trigger: ReactElement; text: string; format?: "markdown" }) {
  const id = useId();
  const normalized = text.replace(/\s+/g, " ").trim();
  const cutoff = normalized.slice(0, 240).lastIndexOf(" ");
  const excerpt = normalized.length > 240 ? `${normalized.slice(0, cutoff > 180 ? cutoff : 240).trimEnd()}…` : normalized;
  return <Tooltip.Root>
    <Tooltip.Trigger render={trigger} delay={100} closeDelay={100} aria-describedby={id} />
    <Tooltip.Portal>
      <Tooltip.Positioner side="top" align="end" sideOffset={8} collisionPadding={12} className="z-[90]">
        <Tooltip.Popup id={id} role="tooltip" className="library-note-tooltip ui-popover w-72 max-w-[calc(100vw-2rem)] p-3">
          <p className="mb-2 text-xs font-medium text-text-secondary">{format === "markdown" ? "Markdown note" : "Note"}</p>
          <p className="library-note-excerpt" data-truncated={normalized.length > 200 || undefined}>{excerpt}</p>
        </Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>;
}
