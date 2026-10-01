import Link from "next/link";
import type { ReactNode } from "react";
import { CollectionIcon, HashIcon, ArrowRightIcon, DeleteIcon, EditIcon, LayersIcon } from "./shell-icons";
import { ITEM_DETAILS_CONTROL } from "./item-page-styles";

type Props = {
  label: string;
  summary: { label: string; value: string };
  collections: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  createdAt: number;
  updatedAt?: number;
  sourceFileName?: string;
  className?: string;
  controls?: ReactNode;
  mediaAction?: ReactNode;
  onEdit: () => void;
  onOrganize: () => void;
  onDelete: () => void;
  disabled?: boolean;
  editDisabled?: boolean;
  editLabel?: string;
  deleteLabel?: string;
};

const ORGANIZATION_LINK = "inline-flex min-h-9 min-w-0 max-w-full items-center gap-2 rounded-control px-2 py-1 text-sm text-text-primary hover:bg-bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";

function DateRow({ label, value }: { label: string; value: number }) {
  const date = new Date(value);
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <dt className="text-text-secondary">{label}</dt>
      <dd><time dateTime={date.toISOString()}>{date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time></dd>
    </div>
  );
}

export function ItemLibraryDetails({
  label, summary, collections, tags, createdAt, updatedAt, sourceFileName,
  controls, mediaAction, onEdit, onOrganize, onDelete,
  disabled = false, editDisabled = false, editLabel = "Edit details",
  deleteLabel = "Move item to Trash", className = "",
}: Props) {
  const metadata = (
    <dl className="grid gap-2 text-xs text-text-primary">
      <div className="flex items-baseline justify-between gap-4"><dt className="text-text-secondary">{summary.label}</dt><dd className="min-w-0 text-right">{summary.value}</dd></div>
      <DateRow label="Saved" value={createdAt} />
      {updatedAt !== undefined && updatedAt !== createdAt ? <DateRow label="Last edit" value={updatedAt} /> : null}
      {sourceFileName ? <div className="grid gap-1"><dt className="text-text-secondary">Original file</dt><dd className="break-all">{sourceFileName}</dd></div> : null}
    </dl>
  );

  return (
    <aside aria-label={label} className={`library-panel squircle-panel flex min-w-0 flex-col rounded-panel border border-border-control bg-bg-surface p-5 ${className}`}>
      <div className="shrink-0">
        {metadata}
        <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-t border-border-control pt-3">
          <h3 className="flex min-h-9 items-center text-xs text-text-secondary" title="Collection"><CollectionIcon className="size-4" /><span className="sr-only">Collection</span></h3>
          <div className="flex flex-col items-start">
            {collections.length ? collections.map((collection) => (
              <Link key={collection.id} href={`/?collection=${encodeURIComponent(collection.id)}`} className={`${ORGANIZATION_LINK} group w-full justify-between font-medium`}>
                <span className="min-w-0 break-words">{collection.name}</span><ArrowRightIcon className="size-4 shrink-0 text-text-secondary" />
              </Link>
            )) : <Link href="/?unsorted=1" className={`${ORGANIZATION_LINK} w-full justify-between font-medium`}>Unsorted<ArrowRightIcon className="size-4 text-text-secondary" /></Link>}
          </div>
          <h3 className="flex min-h-8 items-center text-xs text-text-secondary" title="Tags"><HashIcon className="size-4" /><span className="sr-only">Tags</span></h3>
          <div className="flex max-h-[4.375rem] flex-wrap gap-1.5 overflow-hidden">
            {tags.length ? tags.map((tag) => (
              <Link key={tag.id} href={`/?tag=${encodeURIComponent(tag.id)}`} title={tag.name} className="inline-flex h-8 max-w-full shrink-0 items-center rounded-control bg-bg-control px-2.5 py-1 text-xs text-text-secondary hover:bg-bg-raised hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"><span className="truncate">{tag.name}</span></Link>
            )) : <p className="flex min-h-8 items-center py-1 text-xs text-text-secondary">No tags</p>}
          </div>
        </div>
        <button className={`${ITEM_DETAILS_CONTROL} mt-3 w-full`} type="button" disabled={disabled} onClick={onOrganize}>
          <LayersIcon className="size-4" />Organize
        </button>
      </div>
      <div className="mb-3 mt-4 grid shrink-0 gap-2 border-t border-border-control pt-3">
        {controls}
        <div className={`grid gap-2 ${mediaAction ? "grid-cols-2" : ""}`} role="group" aria-label={mediaAction ? "Image actions" : "Item actions"}>
          {mediaAction}
          <button className={ITEM_DETAILS_CONTROL} type="button" aria-label={editLabel} disabled={disabled || editDisabled} onClick={onEdit}>
            <EditIcon className="size-4" />Edit details
          </button>
        </div>
      </div>
      <div className="mt-auto grid shrink-0 gap-2 border-t border-border-control pt-3">
        <button className={`${ITEM_DETAILS_CONTROL} whitespace-nowrap text-text-danger hover:bg-bg-danger focus-visible:bg-bg-danger`} type="button" aria-label={deleteLabel} disabled={disabled} onClick={onDelete}>
          <DeleteIcon className="size-4" />Move to Trash
        </button>
      </div>
    </aside>
  );
}
