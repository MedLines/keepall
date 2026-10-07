import { ItemOpenLink } from "./item-open-link";
import type { DocumentItem } from "@/domain/document";
import type { NoteItem } from "@/domain/note";
import { itemListTitle } from "@/domain/item";
import { LibraryTextPreview } from "./library-text-preview";
import { ItemTypeBadge, ItemTypeIcon } from "./item-type-icon";
import { CardNote, CardPin } from "./library-card-details";
import { SearchHighlight } from "./search-highlight";
import { ItemViewTransition } from "./item-view-transition";
import { TextDocumentLoading } from "./document-loading-content";

function previewStatus(text: string | null, type: "note" | "document") {
  if (text === null) return "Preview unavailable";
  return type === "note" ? "No text preview" : "Empty file";
}

export function LibraryReadingCard({ item, text, query, pinned, openHref, onOpen }: {
  item: NoteItem | DocumentItem; text: string | null | undefined; query: string; pinned: boolean; openHref?: string; onOpen: () => void;
}) {
  const title = itemListTitle(item);
  const preview = <div className="library-reading-inset media-squircle-inset" data-document-preview={item.type === "document" ? text ?? undefined : undefined}>
    {text === undefined ? <TextDocumentLoading compact /> : text?.trim() ? <LibraryTextPreview text={text} markdown={item.format === "markdown"} query={query} /> : <div className="library-reading-empty">
      <ItemTypeIcon item={item} className="size-8" />
      <p>{previewStatus(text, item.type)}</p>
    </div>}
    <ItemTypeBadge item={item} />
  </div>;
  const body = <>
    <div className="library-reading-media">
      <div className="library-card-media">
        {item.type === "document" ? <ItemViewTransition itemId={item.id} assetId={item.assetId} kind="document" source>{preview}</ItemViewTransition> : preview}
      </div>
    </div>
    <h2 className="library-card-title library-reading-title">{pinned ? <CardPin /> : null}<span className="truncate"><SearchHighlight text={title} query={query} /></span></h2>
  </>;
  const className = "library-reading-open block min-w-0 w-full text-start";
  return <div className="min-w-0">
    {item.deletedAt !== undefined ? <div className={className}>{body}</div> : openHref ? <ItemOpenLink href={openHref} aria-label={`Open ${title}`} className={className}>{body}</ItemOpenLink>
      : <button type="button" aria-label={`Open ${title}`} onClick={onOpen} className={className}>{body}</button>}
    <p className="library-card-file" title={item.type === "document" ? item.sourceFileName : undefined}>
      {item.type === "document" ? <SearchHighlight text={item.sourceFileName} query={query} /> : <>{item.deletedAt !== undefined ? "Moved to Trash" : "Edited"} <time dateTime={new Date(item.updatedAt).toISOString()}>{new Date(item.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time></>}
    </p>
    {item.type === "document" && item.noteContent.trim() ? <div className="mt-2"><CardNote content={item.noteContent} format={item.noteFormat} title={title} query={query} openHref={openHref} onOpen={onOpen} readOnly={item.deletedAt !== undefined} /></div> : null}
  </div>;
}
