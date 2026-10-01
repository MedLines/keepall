import Link from "next/link";
import type { ReactNode } from "react";
import { CollectionIcon, HashIcon, ArrowRightIcon } from "./shell-icons";

type Props = {
  label: string;
  summary: { label: string; value: string };
  collections: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  createdAt: number;
  updatedAt?: number;
  sourceFileName?: string;
  className?: string;
  actions?: ReactNode;
  controls?: ReactNode;
  organizationActions?: ReactNode;
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

export function ItemLibraryDetails({ label, summary, collections, tags, createdAt, updatedAt, sourceFileName, actions, controls, organizationActions, className = "" }: Props) {
  const metadata = (
    <dl className={`grid ${controls ? "gap-2" : "gap-3 border-t border-border-control pt-4"} text-xs text-text-primary`}>
      <div className="flex items-baseline justify-between gap-4"><dt className="text-text-secondary">{summary.label}</dt><dd className="min-w-0 text-right">{summary.value}</dd></div>
      <DateRow label="Saved" value={createdAt} />
      {updatedAt !== undefined && updatedAt !== createdAt ? <DateRow label="Last edit" value={updatedAt} /> : null}
      {sourceFileName ? <div className="grid gap-1"><dt className="text-text-secondary">Original file</dt><dd className="break-all">{sourceFileName}</dd></div> : null}
    </dl>
  );

  return (
    <aside aria-label={label} className={`library-panel squircle-panel min-w-0 rounded-panel border border-border-control bg-bg-surface p-5 ${controls ? "lg:flex lg:flex-col" : ""} ${className}`}>
      {controls ? null : (
        <div className="shrink-0 border-b border-border-control pb-4">
          <h2 className="text-base font-semibold text-text-primary">Details</h2>
        </div>
      )}
      <div className={controls ? "shrink-0" : undefined}>
        {controls ? metadata : null}
        <div className={controls ? "mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-t border-border-control pt-3" : "py-4"}>
          <h3 className={`${controls ? "min-h-9" : "mb-1"} flex items-center gap-2 text-xs text-text-secondary`} title="Collection"><CollectionIcon className="size-4" /><span className={controls ? "sr-only" : undefined}>Collection</span></h3>
          <div className="flex flex-col items-start">
            {collections.length ? collections.map((collection) => (
              <Link key={collection.id} href={`/?collection=${encodeURIComponent(collection.id)}`} className={`${ORGANIZATION_LINK} group w-full justify-between font-medium`}>
                <span className="min-w-0 break-words">{collection.name}</span><ArrowRightIcon className="size-4 shrink-0 text-text-secondary" />
              </Link>
            )) : <Link href="/?unsorted=1" className={`${ORGANIZATION_LINK} w-full justify-between font-medium`}>Unsorted<ArrowRightIcon className="size-4 text-text-secondary" /></Link>}
          </div>
          <h3 className={`${controls ? "min-h-8" : "mb-2 mt-4"} flex items-center gap-2 text-xs text-text-secondary`} title="Tags"><HashIcon className="size-4" /><span className={controls ? "sr-only" : undefined}>Tags</span></h3>
          <div className={`flex flex-wrap gap-1.5 ${controls ? "max-h-[4.375rem] overflow-hidden" : ""}`}>
            {tags.length ? tags.map((tag) => (
              <Link key={tag.id} href={`/?tag=${encodeURIComponent(tag.id)}`} title={tag.name} className={`inline-flex min-h-8 max-w-full items-center rounded-control bg-bg-control px-2.5 py-1 text-xs text-text-secondary hover:bg-bg-raised hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus ${controls ? "h-8 shrink-0" : ""}`}><span className={controls ? "truncate" : "break-words"}>{tag.name}</span></Link>
            )) : <p className={`${controls ? "flex min-h-8 items-center " : ""}py-1 text-xs text-text-secondary`}>No tags</p>}
          </div>
        </div>
        {organizationActions ? <div className="mt-3 grid gap-2">{organizationActions}</div> : null}
        {controls ? null : metadata}
      </div>
      {controls ? <div className="mb-3 mt-4 shrink-0 border-t border-border-control pt-3">{controls}</div> : null}
      {actions ? (
        <div className={`${controls ? "mt-auto pt-3" : "mt-5 pt-4"} grid shrink-0 gap-2 border-t border-border-control`}>
          {actions}
        </div>
      ) : null}
    </aside>
  );
}
