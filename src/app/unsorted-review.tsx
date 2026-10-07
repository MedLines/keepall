"use client";

import { useRef, useState } from "react";
import type { Item } from "@/domain/item";
import type { Collection } from "@/domain/collection";
import type { Tag } from "@/domain/tag";
import { createCollection } from "@/persistence/collections";
import { createTag } from "@/persistence/tags";
import { applyUnsortedReviewAction, undoUnsortedReviewAction, rebaseUnsortedReviewUndo, type UnsortedReviewAction, type UnsortedReviewUndo } from "@/persistence/unsorted-review";
import { CaptureOrgPanel } from "./capture-org-panel";
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
  const [collectionName, setCollectionName] = useState<string | null>(null);
  const [collectionInput, setCollectionInput] = useState("");
  const [tagName, setTagName] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const item = items.find(entry => entry.id === queue[index] && entry.deletedAt === undefined && entry.collectionIds.length === 0) ?? null;
  const done = index >= queue.length;
  const notifyChanged = () => window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));

  async function apply(action: () => Promise<UnsortedReviewAction>, message: string, advance: boolean) {
    if (!item || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const requestedAction = await action();
      const result = await applyUnsortedReviewAction(item.id, requestedAction);
      if (result.undo) setHistory(previous => [...previous.map(entry => ({ ...entry, undo: entry.undo ? rebaseUnsortedReviewUndo(entry.undo, result) : null })), { index, undo: result.undo, notice: message }]);
      setNotice(result.undo ? message : requestedAction.kind === "remove-tag" ? "This tag is no longer on the item." : "This tag is already on the item.");
      setTagName("");
      if (advance) { setIndex(index + 1); setCollectionName(null); setCollectionInput(""); }
      notifyChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Couldn't update this item. Try again."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  function skip() {
    if (inFlight.current || done) return;
    setHistory(previous => [...previous, { index, undo: null, notice: "Skipped. The item stays in Unsorted." }]);
    setIndex(index + 1); setCollectionName(null); setCollectionInput(""); setTagName(""); setError(null); setNotice("Skipped. The item stays in Unsorted.");
  }
  async function undo() {
    const previous = history.at(-1);
    if (!previous || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const result = previous.undo ? await undoUnsortedReviewAction(previous.undo) : null;
      setHistory(entries => entries.slice(0, -1).map(entry => ({ ...entry, undo: entry.undo && result ? rebaseUnsortedReviewUndo(entry.undo, result) : entry.undo })));
      setIndex(previous.index); setCollectionName(null); setCollectionInput(""); setTagName("");
      setNotice("Undone. Returned to the same review position.");
      notifyChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Couldn't undo this action. Try again."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const footer = <div className="space-y-3" aria-busy={busy}>
    <p role="status" aria-live="polite" className="text-sm tabular-nums text-text-secondary">{index} of {queue.length} reviewed{!done ? ` · Item ${index + 1}` : ""}</p>
    {item ? <>
      <p className="text-xs text-text-secondary">Choose a collection, then File and next. Tags apply immediately.</p>
      <CaptureOrgPanel
        key={item.id}
        collectionName={collectionName}
        collectionInput={collectionInput}
        collectionInputLabel="Move to collection"
        collectionSuggestions={collections}
        tagNames={item.tagIds.flatMap(tagId => tags.find(tag => tag.id === tagId)?.name ?? [])}
        tagInput={tagName}
        tagInputLabel="Add tag"
        tagSuggestions={tags}
        disabled={busy}
        onCollectionInputChange={setCollectionInput}
        onSetCollection={name => { setCollectionName(name); setCollectionInput(""); }}
        onClearCollection={() => { setCollectionName(null); setCollectionInput(""); }}
        onTagInputChange={setTagName}
        onAddTag={name => void apply(async () => ({ kind: "tag", tagId: (await createTag({ name })).id }), "Tag added. The item stays in Unsorted.", false)}
        onRemoveTag={name => {
          const tag = tags.find(entry => entry.name === name);
          if (tag) void apply(async () => ({ kind: "remove-tag", tagId: tag.id }), "Tag removed. The item stays in Unsorted.", false);
        }}
      />
      <button type="button" disabled={busy || !collectionName} className="ui-control ui-primary min-h-11 px-3 text-sm disabled:opacity-50"
        onClick={() => {
          if (collectionName) void apply(async () => ({ kind: "file", collectionId: (await createCollection({ name: collectionName })).id }), "Filed in a collection.", true);
        }}>File and next</button>
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
