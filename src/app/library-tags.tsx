"use client";

import { itemListTitle, type Item } from "@/domain/item";
import { LibraryItemMedia } from "./library-item-media";
import { LibraryOrganizationLinkPreview } from "./library-organization-link-preview";
import { ImageIcon, LinkIcon, NoteIcon, VideoIcon } from "./shell-icons";

const itemIcons = { note: NoteIcon, image: ImageIcon, link: LinkIcon, video: VideoIcon };

export function LibraryTagArtwork({ previews }: { previews: Item[] }) {
  return (
    <span className="library-card-media library-tag-stage" aria-hidden="true">
      {previews.length > 0 ? <span className="library-tag-previews" data-count={previews.length}>
        {previews.map(item => <TagItemPreview key={item.id} item={item} />)}
      </span> : <span className="library-tag-empty">No items yet</span>}
    </span>
  );
}

function TagItemPreview({ item }: { item: Item }) {
  const Icon = itemIcons[item.type];
  return <span className="library-tag-preview" data-type={item.type}>
    {item.type === "note" ? <span className="library-tag-note">
      <span className="library-tag-note-heading"><Icon className="size-3.5" /><span>{itemListTitle(item)}</span></span>
      <span className="library-tag-note-content">{item.content.slice(0, 400)}</span>
    </span> : item.type === "link" ? <LibraryOrganizationLinkPreview item={item} showType /> : <>
      <LibraryItemMedia item={item} compact />
      <span className="library-tag-preview-type"><Icon className="size-3.5" /></span>
    </>}
  </span>;
}
