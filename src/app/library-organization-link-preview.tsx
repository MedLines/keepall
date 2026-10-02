"use client";

import { useState } from "react";
import { linkCardHost } from "@/domain/card-display";
import type { LinkItem } from "@/domain/link";
import { useAssetObjectUrl } from "./use-asset-object-url";
import { LinkIcon } from "./shell-icons";

export function LibraryOrganizationLinkPreview({ item, showType = false, folder = false }: { item: LinkItem; showType?: boolean; folder?: boolean }) {
  const imageUrl = useAssetObjectUrl(item.previewAssetId);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (imageUrl && imageUrl !== failedUrl) {
    return <>
      {/* eslint-disable-next-line @next/next/no-img-element -- local IndexedDB object URL */}
      <img alt="" src={imageUrl} className="size-full object-cover" onError={() => setFailedUrl(imageUrl)} />
      {showType ? <span className="library-tag-preview-type"><LinkIcon className="size-3.5" /></span> : null}
    </>;
  }
  const host = linkCardHost(item);
  const title = item.title.trim() || item.previewTitle.trim() || item.url.replace(/^https?:\/\//, "");
  if (folder) return <span className="collection-folder-text-preview">
    <span className="collection-folder-preview-title">{title}</span>
    <LinkIcon />
  </span>;
  return <span className="library-tag-link">
    <span className="library-tag-link-source">
      <span className="library-tag-link-mark">{host.replace(/^www\./, "").slice(0, 1).toUpperCase()}</span>
      <span className="library-tag-link-host">{host}</span>
    </span>
    <span className="library-tag-link-title">{title}</span>
  </span>;
}
