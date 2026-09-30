import Link from "next/link";
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

export function ItemLibraryDetails({ label, summary, collections, tags, createdAt, updatedAt, sourceFileName, className = "" }: Props) {
  return (
    <aside aria-label={label} className={`library-panel squircle-panel min-w-0 rounded-panel border border-border-control bg-bg-surface p-5 ${className}`}>
      <div className="border-b border-border-control pb-4">
        <h2 className="text-base font-semibold text-text-primary">Details</h2>
      </div>
      <div className="py-4">
        <h3 className="mb-1 flex items-center gap-2 text-xs text-text-secondary"><CollectionIcon className="size-4" />Collection</h3>
        <div className="flex flex-col items-start">
          {collections.length ? collections.map((collection) => (
            <Link key={collection.id} href={`/?collection=${encodeURIComponent(collection.id)}`} className={`${ORGANIZATION_LINK} group w-full justify-between font-medium`}>
              <span className="min-w-0 break-words">{collection.name}</span><ArrowRightIcon className="size-4 shrink-0 text-text-secondary" />
            </Link>
          )) : <Link href="/?unsorted=1" className={`${ORGANIZATION_LINK} w-full justify-between font-medium`}>Unsorted<ArrowRightIcon className="size-4 text-text-secondary" /></Link>}
        </div>
        <h3 className="mb-2 mt-4 flex items-center gap-2 text-xs text-text-secondary"><HashIcon className="size-4" />Tags</h3>
        <div className="flex flex-wrap gap-1.5">
          {tags.length ? tags.map((tag) => (
            <Link key={tag.id} href={`/?tag=${encodeURIComponent(tag.id)}`} className="inline-flex min-h-8 max-w-full items-center rounded-control bg-bg-control px-2.5 py-1 text-xs text-text-secondary hover:bg-bg-raised hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"><span className="break-words">{tag.name}</span></Link>
          )) : <p className="py-1 text-xs text-text-secondary">No tags</p>}
        </div>
      </div>
      <dl className="grid gap-3 border-t border-border-control pt-4 text-xs text-text-primary">
        <div className="flex items-baseline justify-between gap-4"><dt className="text-text-secondary">{summary.label}</dt><dd className="min-w-0 text-right">{summary.value}</dd></div>
        <DateRow label="Saved" value={createdAt} />
        {updatedAt !== undefined && updatedAt !== createdAt ? <DateRow label="Last edit" value={updatedAt} /> : null}
        {sourceFileName ? <div className="grid gap-1"><dt className="text-text-secondary">Original file</dt><dd className="break-all">{sourceFileName}</dd></div> : null}
      </dl>
    </aside>
  );
}
