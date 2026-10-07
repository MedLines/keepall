"use client";

import { ItemOpenLink } from "./item-open-link";
import type { DocumentItem } from "@/domain/document";
import { itemListTitle } from "@/domain/item";
import { SearchHighlight } from "./search-highlight";
import { CardNote, CardPin } from "./library-card-details";
import { LibraryReadingCard } from "./library-reading-card";
import { useDocumentPreview } from "./use-document-preview";

export function LibraryDocumentCard({ item, query, pinned, openHref, onOpen }: {
  item: DocumentItem; query: string; pinned: boolean; openHref?: string; onOpen: () => void;
}) {
  const preview = useDocumentPreview(item);
  const title = itemListTitle(item);
  if (item.format === "pdf") {
    const titleContent = <><span className="truncate"><SearchHighlight text={title} query={query} /></span></>;
    const titleClassName = "library-card-title-action library-card-hit-area";
    const fileTitle = item.sourceFileName.replace(/\.pdf$/i, "").trim();
    const showFileName = ![item.sourceFileName.trim(), fileTitle].some(value => value.toLocaleLowerCase() === title.trim().toLocaleLowerCase());
    return <div className="library-card-copy">
      <h2 className="library-card-title">
        {pinned ? <CardPin /> : null}
        {item.deletedAt !== undefined ? <span className={titleClassName}>{titleContent}</span> : openHref ? <ItemOpenLink href={openHref} className={titleClassName}>{titleContent}</ItemOpenLink>
          : <button type="button" onClick={onOpen} className={titleClassName}>{titleContent}</button>}
      </h2>
      {showFileName ? <p className="library-card-file" title={item.sourceFileName}><SearchHighlight text={item.sourceFileName} query={query} /></p> : null}
      <CardNote content={item.noteContent} format={item.noteFormat} title={title} query={query} openHref={openHref} onOpen={onOpen} readOnly={item.deletedAt !== undefined} />
    </div>;
  }
  return <LibraryReadingCard item={item} text={preview?.text} query={query} pinned={pinned} openHref={openHref} onOpen={onOpen} />;
}
