"use client";

import { useId, useRef, useState } from "react";
import type { Item } from "@/domain/item";
import type { Collection } from "@/domain/collection";
import type { Tag } from "@/domain/tag";
import { createCollection } from "@/persistence/collections";
import { createTag } from "@/persistence/tags";
import { applyUnsortedReviewAction, undoUnsortedReviewAction, rebaseUnsortedReviewUndo, type UnsortedReviewAction, type UnsortedReviewUndo } from "@/persistence/unsorted-review";
import { LibraryQuickPreview } from "./library-quick-preview";
import { ITEMS_CHANGED_EVENT } from "./items-events";

type Props = {
  items: Item[];
  collections: Collection[];
  tags: Tag[];
  onClose: () => void;
  onOpenItem: (item: Item) => void;
  returnFocus: () => HTMLElement | null;
};
type HistoryEntry = { index: number; undo: UnsortedReviewUndo | null; notice: string };

export function UnsortedReview({ items, collections, tags, onClose, onOpenItem, returnFocus }: Props) {
  const [queue] = useState(() => items.filter(item => item.deletedAt === undefined && item.collectionIds.length === 0).map(item => item.id));
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [collectionName, setCollectionName] = useState("");
  const [tagName, setTagName] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const id = useId();
  const item = items.find(entry => entry.id === queue[index] && entry.deletedAt === undefined && entry.collectionIds.length === 0) ?? null;
  const done = index >= queue.length;
  const notifyChanged = () => window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));

  async function apply(action: () => Promise<UnsortedReviewAction>, message: string, advance: boolean) {
    if (!item || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const result = await applyUnsortedReviewAction(item.id, await action());
      if (result.undo) setHistory(previous => [...previous.map(entry => ({ ...entry, undo: entry.undo ? rebaseUnsortedReviewUndo(entry.undo, result) : null })), { index, undo: result.undo, notice: message }]);
      setNotice(result.undo ? message : "This tag is already on the item.");
      setTagName("");
      if (advance) { setIndex(index + 1); setCollectionName(""); }
      notifyChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Couldn't update this item. Try again."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  function skip() {
    if (inFlight.current || done) return;
    setHistory(previous => [...previous, { index, undo: null, notice: "Skipped. The item stays in Unsorted." }]);
    setIndex(index + 1); setCollectionName(""); setTagName(""); setError(null); setNotice("Skipped. The item stays in Unsorted.");
  }
  async function undo() {
    const previous = history.at(-1);
    if (!previous || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const result = previous.undo ? await undoUnsortedReviewAction(previous.undo) : null;
      setHistory(entries => entries.slice(0, -1).map(entry => ({ ...entry, undo: entry.undo && result ? rebaseUnsortedReviewUndo(entry.undo, result) : entry.undo })));
      setIndex(previous.index); setCollectionName(""); setTagName("");
      setNotice("Undone. Returned to the same review position.");
      notifyChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Couldn't undo this action. Try again."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const footer = <div className="space-y-3" aria-busy={busy}>
    <p role="status" aria-live="polite" className="text-sm tabular-nums text-text-secondary">{index} of {queue.length} reviewed{!done ? ` · Item ${index + 1}` : ""}</p>
    {item ? <>
      <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
        event.preventDefault();
        if (collectionName.trim()) void apply(async () => ({ kind: "file", collectionId: (await createCollection({ name: collectionName })).id }), "Filed in a collection.", true);
      }}>
        <div className="min-w-0 flex-1 basis-40"><label htmlFor={`${id}-collection`} className="mb-1 block text-xs text-text-secondary">Move to collection</label>
          <input id={`${id}-collection`} list={`${id}-collections`} className="ui-field h-10 w-full text-sm" placeholder="Choose or create a collection" value={collectionName} disabled={busy} onChange={event => setCollectionName(event.target.value)} />
          <datalist id={`${id}-collections`}>{collections.map(collection => <option key={collection.id} value={collection.name} />)}</datalist>
        </div>
        <button type="submit" disabled={busy || !collectionName.trim()} className="ui-control ui-primary min-h-10 px-3 text-sm disabled:opacity-50">File and next</button>
      </form>
      <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
        event.preventDefault();
        if (tagName.trim()) void apply(async () => ({ kind: "tag", tagId: (await createTag({ name: tagName })).id }), "Tag added. The item stays in Unsorted.", false);
      }}>
        <div className="min-w-0 flex-1 basis-40"><label htmlFor={`${id}-tag`} className="mb-1 block text-xs text-text-secondary">Add tag</label>
          <input id={`${id}-tag`} list={`${id}-tags`} className="ui-field h-10 w-full text-sm" placeholder="Choose or create a tag" value={tagName} disabled={busy} onChange={event => setTagName(event.target.value)} />
          <datalist id={`${id}-tags`}>{tags.map(tag => <option key={tag.id} value={tag.name} />)}</datalist>
        </div>
        <button type="submit" disabled={busy || !tagName.trim()} className="ui-control min-h-10 px-3 text-sm disabled:opacity-50">Add tag</button>
      </form>
      {item.tagIds.length ? <p className="break-words text-xs text-text-secondary">Tags: {item.tagIds.map(tagId => tags.find(tag => tag.id === tagId)?.name).filter(Boolean).join(", ")}</p> : null}
    </> : null}
    <div className="flex flex-wrap items-center gap-2">
      {!done ? <button type="button" disabled={busy} className="ui-control min-h-11 px-3 text-sm" onClick={skip}>Skip</button> : null}
      {item ? <button type="button" disabled={busy} className="ui-control min-h-11 px-3 text-sm text-text-danger" title="Move this item to Trash" onClick={() => void apply(async () => ({ kind: "delete" }), "Moved to Trash.", true)}>Delete</button> : null}
      <button type="button" disabled={busy || history.length === 0} className="ui-control min-h-11 px-3 text-sm disabled:opacity-50" title={history.at(-1)?.notice} onClick={() => void undo()}>Undo</button>
      {done ? <button type="button" disabled={busy} className="ui-control ui-primary min-h-11 px-3 text-sm" onClick={onClose}>Back to Unsorted</button> : null}
    </div>
    <p role="status" aria-live="polite" className="text-xs text-text-secondary">{notice}</p>
    {error ? <p role="alert" className="text-sm text-text-danger">{error}</p> : null}
  </div>;
  return <LibraryQuickPreview item={item} index={index} count={queue.length} onMove={() => {}} onClose={() => { if (!inFlight.current) onClose(); }} onOpenItem={entry => { if (!inFlight.current) { onClose(); onOpenItem(entry); } }} returnFocus={returnFocus}
    review={{ footer, busy, emptyState: <div className="max-w-prose space-y-3 text-sm text-text-secondary"><h2 className="text-lg font-semibold text-text-primary">{queue.length === 0 ? "Nothing to review" : done ? "Review complete" : "This item moved or was deleted"}</h2><p>{done ? "Items you skipped and items with only tags stay in Unsorted. Start another review whenever you're ready." : "The queue changed in another view. Skip this position to keep reviewing."}</p><p>Undo stays available until you close this review.</p></div> }} />;
}
