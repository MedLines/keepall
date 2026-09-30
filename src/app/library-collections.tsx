"use client";

import { useId } from "react";
import type { Item } from "@/domain/item";
import { LibraryOrganizationPreview } from "./library-organization-preview";
import "./library-collections.css";

const FOLDER_FRONT_PATH = "M1 78C1 59 10 50 29 50H92C104 50 110 54 119 60L137 70C144 74 149 76 160 76H251C270 76 279 85 279 104V211C279 230 270 239 251 239H29C10 239 1 230 1 211Z";

export function LibraryFolderArtwork({ previews }: { previews: Item[] }) {
  return (
    <span className="collection-folder-stage" aria-hidden="true">
      <span className="collection-folder-back" />
      <span className="collection-folder-previews">
        {previews.slice(0, 3).map((item, index) => (
          <span key={item.id} className="collection-folder-preview" data-type={item.type} data-position={["center", "left", "right"][index]}>
            <LibraryOrganizationPreview item={item} />
          </span>
        ))}
      </span>
      <FolderFront />
    </span>
  );
}

function FolderFront() {
  const gradientId = useId();
  const glassId = useId();
  return (
    <span className="collection-folder-front">
      <svg className="collection-folder-front-shape" viewBox="0 0 280 240" fill="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0.7" y2="1">
            <stop offset="0" className="collection-folder-gradient-top" />
            <stop offset="0.5" className="collection-folder-gradient-middle" />
            <stop offset="1" className="collection-folder-gradient-bottom" />
          </linearGradient>
          <linearGradient id={glassId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="collection-folder-glass-top" />
            <stop offset="0.48" className="collection-folder-glass-middle" />
            <stop offset="0.78" className="collection-folder-glass-bottom" />
          </linearGradient>
        </defs>
        <path className="collection-folder-front-solid" fill={`url(#${gradientId})`} d={FOLDER_FRONT_PATH} />
        <path className="collection-folder-front-glass" fill={`url(#${glassId})`} d={FOLDER_FRONT_PATH} />
      </svg>
    </span>
  );
}
