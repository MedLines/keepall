"use client";

import { itemListTitle, type Item } from "@/domain/item";
import { LibraryItemMedia } from "./library-item-media";
import { LibraryOrganizationLinkPreview } from "./library-organization-link-preview";
import { NoteIcon } from "./shell-icons";

export function LibraryOrganizationPreview({ item }: { item: Item }) {
  return (
    <span className="collection-folder-item-card">
      {item.type === "note" ? <span className="collection-folder-text-preview">
        <span className="collection-folder-preview-title">{itemListTitle(item)}</span>
        <NoteIcon />
      </span> :
        <span className="collection-folder-media">
          {item.type === "link" ? <LibraryOrganizationLinkPreview item={item} folder /> : <LibraryItemMedia item={item} compact />}
        </span>
      }
    </span>
  );
}
