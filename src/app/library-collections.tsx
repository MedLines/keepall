"use client";

import { useId } from "react";
import type { Item } from "@/domain/item";
import { LibraryOrganizationPreview } from "./library-organization-preview";
import { ImageIcon, LinkIcon, NoteIcon, VideoIcon } from "./shell-icons";
import "./library-collections.css";

const FOLDER_FRONT_PATH = "M1 78C1 59 10 50 29 50H92C104 50 110 54 119 60L137 70C144 74 149 76 160 76H251C270 76 279 85 279 104V211C279 230 270 239 251 239H29C10 239 1 230 1 211Z";
const itemIcons = { note: NoteIcon, image: ImageIcon, link: LinkIcon, video: VideoIcon, document: NoteIcon };

export function LibraryFolderArtwork({ previews, itemTypes, emptyState = false }: { previews: Item[]; itemTypes: Item["type"][]; emptyState?: boolean }) {
  return (
    <span className={`collection-folder-stage${emptyState ? " library-empty-folder" : ""}`} aria-hidden="true">
      <span className="collection-folder-back" />
      <span className="collection-folder-previews">
        {previews.slice(0, 3).map((item, index) => (
          <span key={item.id} className="collection-folder-preview" data-type={item.type} data-position={["center", "left", "right"][index]}>
            <LibraryOrganizationPreview item={item} />
          </span>
        ))}
        {emptyState ? ["center", "left", "right"].map(position => <span key={position} className="collection-folder-preview library-empty-sheet" data-position={position} />) : null}
      </span>
      <FolderFront itemTypes={itemTypes} />
    </span>
  );
}

function FolderFront({ itemTypes }: { itemTypes: Item["type"][] }) {
  const gradientId = useId();
  return (
    <span className="collection-folder-front">
      <svg className="collection-folder-front-shape" viewBox="0 0 280 240" fill="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="collection-folder-gradient-top" />
            <stop offset="0.48" className="collection-folder-gradient-middle" />
            <stop offset="0.78" className="collection-folder-gradient-bottom" />
          </linearGradient>
        </defs>
        <path className="collection-folder-front-surface" fill={`url(#${gradientId})`} d={FOLDER_FRONT_PATH} />
      </svg>
      {itemTypes.length > 0 ? <span className="collection-folder-types">
        {itemTypes.map(type => {
          const Icon = itemIcons[type];
          return <span key={type} className="collection-folder-type" data-type={type} title={type}><Icon /></span>;
        })}
      </span> : null}
    </span>
  );
}
