"use client";

import { ItemOpenLink } from "./item-open-link";
import { ItemViewTransition } from "./item-view-transition";
import { cardSecondaryLine, noteCardText } from "@/domain/card-display";
import { itemListTitle, type Item } from "@/domain/item";
import type { SearchExcerpt } from "@/domain/search";
import { CardNote, CardPin, CardSource } from "./library-card-details";
import { ItemTypeBadge } from "./item-type-icon";
import { SearchHighlight, SearchResult } from "./search-highlight";

export function LibraryListContent({ item, pinned, onOpen, openHref, query = "", tagNames = [], searchExcerpt }: {
  item: Item;
  pinned: boolean;
  onOpen: () => void;
  openHref?: string;
  query?: string;
  tagNames?: readonly string[];
  searchExcerpt?: SearchExcerpt;
}) {
  const title = item.type === "image" ? item.title.trim() || "Image" : itemListTitle(item);
  const sourceUrl = item.type === "link" ? item.url : item.type === "image" ? item.sourceUrl : "";
  const personalNote = item.type === "image" ? { content: item.caption, format: item.captionFormat }
    : item.type === "link" || item.type === "document" ? { content: item.noteContent ?? "", format: item.noteFormat } : null;
  const secondary = item.type === "note" ? cardSecondaryLine(item)
    : item.type === "document" && ![item.sourceFileName, item.sourceFileName.replace(/\.(pdf|md|txt)$/i, "")]
      .some(name => name.toLocaleLowerCase() === title.toLocaleLowerCase()) ? item.sourceFileName
    : item.type === "image" && item.caption.trim() ? noteCardText({ content: item.caption.slice(0, 600), format: item.captionFormat })
    : "";
  const titleText = <span className="library-list-title">
    <span className="truncate"><SearchHighlight text={title} query={query} /></span>
  </span>;
  const text = item.type === "document" && item.format !== "pdf"
    ? <ItemViewTransition itemId={item.id} assetId={item.assetId} kind="document" source>{titleText}</ItemViewTransition> : titleText;
  const openClass = "library-list-open min-w-0 flex-1 text-start";
  const hasNote = Boolean(personalNote?.content.trim());
  const galleryCount = item.type === "image" && item.assetIds.length > 1 ? item.assetIds.length : null;
  return <SearchResult item={item} query={query} tagNames={tagNames} excerpt={searchExcerpt}>
    <div className="library-list-title-row">
      {item.deletedAt !== undefined ? <div className={openClass}>{text}</div> : item.type === "link" ? (
        <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${itemListTitle(item)}`} className={openClass}>{text}</a>
      ) : openHref ? (
        <ItemOpenLink href={openHref} aria-label={`Open ${itemListTitle(item)}`} className={openClass}>{text}</ItemOpenLink>
      ) : <button type="button" onClick={onOpen} aria-label={`Open ${itemListTitle(item)}`} className={openClass}>{text}</button>}
    </div>
    <div className="library-list-secondary">
      <div className="library-list-icons">
        <ItemTypeBadge item={item} variant="list" />
        {personalNote && hasNote ? <CardNote {...personalNote} title={itemListTitle(item)} openHref={openHref} onOpen={onOpen} readOnly={item.deletedAt !== undefined} query={query} iconOnly /> : null}
        {pinned ? <CardPin /> : null}
      </div>
      {galleryCount ? <span className="library-list-image-count">{galleryCount} images</span> : null}
      {sourceUrl ? <CardSource url={sourceUrl} query={query} showFavicon={false} />
        : secondary ? <span className="library-list-summary"><SearchHighlight text={secondary} query={query} /></span> : null}
    </div>
  </SearchResult>;
}
