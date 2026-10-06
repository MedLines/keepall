"use client";

import { Menu } from "@base-ui/react/menu";
import { useRef } from "react";
import type { OrganizationPreview } from "@/domain/organization-preview";
import type { LibraryLayout } from "@/domain/library-view";
import { LibraryFolderArtwork } from "./library-collections";
import { LibraryTagArtwork } from "./library-tags";
import { LibrarySelectionControl } from "./library-selection-control";
import { RowActionMenu } from "./row-action-menu";
import { DeleteIcon, LinkIcon, MoreIcon } from "./shell-icons";

type Props = {
  entry: OrganizationPreview;
  kind: "collections" | "tags";
  layout: LibraryLayout;
  href: string;
  selected: boolean;
  selectionActive: boolean;
  busy: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onDelete: () => void;
};

export function LibraryOrganizationCard({ entry: { organization, count, previews, itemTypes }, kind, layout, href, selected, selectionActive, busy, onToggleSelect, onOpen, onDelete }: Props) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const folder = kind === "collections";
  return (
    <RowActionMenu
      label={`Actions for ${organization.name}`}
      trigger={<button type="button" aria-label={`${organization.name} actions`} className="organization-actions library-card-actions library-card-media-chrome absolute end-4 top-4 z-30 flex size-11 items-center justify-center"><MoreIcon className="size-4" /></button>} triggerRef={triggerRef}
      disabled={busy}
      menu={() => <>
        <Menu.Item className="ui-menu-item flex items-center gap-2 text-sm text-text-primary outline-none data-[highlighted]:bg-bg-active" render={<a href={href} target="_blank" rel="noopener noreferrer" />}><LinkIcon />Open in new tab</Menu.Item>
        <Menu.Separator className="my-1 border-t border-border-edge" />
        <Menu.Item className="ui-menu-item flex items-center gap-2 text-sm text-text-danger outline-none data-[highlighted]:bg-bg-danger" disabled={busy} onClick={onDelete}><DeleteIcon />Delete {folder ? "folder" : "tag"}</Menu.Item>
      </>}
    >
      {trigger => <li className="organization-card library-card relative min-w-0" data-kind={kind} data-selected={selected} data-selection-active={selectionActive}
        onClickCapture={event => {
          if (!selectionActive || (event.target as HTMLElement).closest("label[data-visible], .organization-actions-container")) return;
          if (!event.currentTarget.contains(event.target as Node)) return;
          event.preventDefault();
          event.stopPropagation();
          if (!busy) onToggleSelect();
        }}
      >
        <LibrarySelectionControl label={`Select ${organization.name}`} className="organization-select library-card-media-chrome absolute start-4 top-4 z-20 flex size-11 items-center justify-center" visible={selected || selectionActive} selected={selected} disabled={busy} onToggle={onToggleSelect} />
        <a
          href={href}
          className={`collection-folder ${folder ? "" : "library-card library-tag-card"}`}
          aria-label={`Open ${organization.name}, ${count} ${count === 1 ? "item" : "items"}`}
          onClick={event => {
            if (busy) { event.preventDefault(); return; }
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onOpen();
          }}
        >
          {folder ? <LibraryFolderArtwork previews={previews} itemTypes={itemTypes} /> : <LibraryTagArtwork previews={previews} compact={layout === "list"} />}
          <span className="organization-copy">
            <span className="collection-folder-name">{organization.name}</span>
            <span className="collection-folder-count">{count} {count === 1 ? "item" : "items"}</span>
          </span>
        </a>
        {trigger ? <span className="organization-actions-container">{trigger}</span> : null}
      </li>}
    </RowActionMenu>
  );
}
