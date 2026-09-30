"use client";

import { itemListTitle, type Item } from "@/domain/item";
import { LibraryItemMedia } from "./library-item-media";
import { LibraryOrganizationLinkPreview } from "./library-organization-link-preview";

export function LibraryOrganizationPreview({ item }: { item: Item }) {
  return (
    <span className="collection-folder-item-card">
      {item.type === "note" ? <>
        <span className="collection-folder-preview-title">{itemListTitle(item)}</span>
        <span className="collection-folder-note">{item.content.slice(0, 160)}</span>
      </> : <>
        <span className="collection-folder-media">
          {item.type === "link" ? <LibraryOrganizationLinkPreview item={item} /> : <LibraryItemMedia item={item} compact />}
        </span>
        <span className="collection-folder-preview-title">{itemListTitle(item)}</span>
      </>}
    </span>
  );
}
