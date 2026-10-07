"use client";

import type { LibraryLayout } from "@/domain/library-view";
import type { OrganizationPreview } from "@/domain/organization-preview";
import { normalizeSearchQuery } from "@/domain/search";
import { LibraryOrganizationCard } from "./library-organization-card";

type Props = {
  entries: OrganizationPreview[];
  layout: LibraryLayout;
  kind: "collections" | "tags";
  query: string;
  selectedIds: ReadonlySet<string>;
  busy: boolean;
  hrefFor: (id: string) => string;
  onOpen: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onDelete: (ids: string[]) => void;
};

export function LibraryOrganizationOverview({ entries, layout, kind, query, selectedIds, busy, hrefFor, onOpen, onToggleSelect, onDelete }: Props) {
  const needle = normalizeSearchQuery(query);
  const visible = entries.filter(entry => entry.organization.name.toLowerCase().includes(needle));
  const folder = kind === "collections";
  if (visible.length === 0) return <p className="text-sm text-text-secondary">{needle ? `No matching ${kind}.` : `No ${kind} yet. Add an item to ${folder ? "a collection" : "a tag"} to start one.`}</p>;
  return <div className="library-organization-overview"><ul className={`collection-folder-grid ${folder ? "" : "library-tag-grid"} ${layout === "list" ? "organization-list" : ""}`} aria-label={`Library ${kind}`}>
    {visible.map(entry => <LibraryOrganizationCard key={entry.organization.id} entry={entry} kind={kind} layout={layout} href={hrefFor(entry.organization.id)} selected={selectedIds.has(entry.organization.id)} selectionActive={selectedIds.size > 0} busy={busy} onToggleSelect={() => onToggleSelect(entry.organization.id)} onOpen={() => onOpen(entry.organization.id)} onDelete={() => onDelete([entry.organization.id])} />)}
  </ul></div>;
}
