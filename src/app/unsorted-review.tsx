"use client";

import { startTransition, useRef, useState } from "react";
import type { Item } from "@/domain/item";
import type { Collection } from "@/domain/collection";
import type { Tag } from "@/domain/tag";
import { createCollection } from "@/persistence/collections";
import { createTag } from "@/persistence/tags";
import { applyUnsortedReviewAction, undoUnsortedReviewAction, rebaseUnsortedReviewUndo, type UnsortedReviewAction, type UnsortedReviewUndo } from "@/persistence/unsorted-review";
import { OrganizationMenu } from "./item-context-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollPanel } from "@/components/ui/scroll-panel";
import { CaptureOrgPanel } from "./capture-org-panel";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, DeleteIcon, UndoIcon } from "./shell-icons";
import { LibraryQuickPreview } from "./library-quick-preview";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { SHELL_DESTRUCTIVE_BTN } from "./shell-styles";

type Props = {
  items: Item[];
  collections: Collection[];
  tags: Tag[];
  onClose: () => void;
  onOpenItem: (item: Item, animate?: boolean, fromPreview?: boolean) => void;
  returnFocus: () => HTMLElement | null;
};
type HistoryEntry = { index: number; undo: UnsortedReviewUndo | null; notice: string };

export function UnsortedReview({ items, collections, tags, onClose, onOpenItem, returnFocus }: Props) {
  const [queue] = useState(() => items.filter(item => item.deletedAt === undefined && item.collectionIds.length === 0).map(item => item.id));
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [collectionName, setCollectionName] = useState<string | null>(null);
  const [collectionInput, setCollectionInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const deleteCancel = useRef<HTMLButtonElement>(null);
  const item = items.find(entry => entry.id === queue[index] && entry.deletedAt === undefined && entry.collectionIds.length === 0) ?? null;
  const done = index >= queue.length;
  const availableIds = new Set(items.filter(entry => entry.deletedAt === undefined && entry.collectionIds.length === 0).map(entry => entry.id));
  const reviewedCount = new Set(history.filter(entry => entry.undo === null || entry.undo.kind === "file" || entry.undo.kind === "delete").map(entry => entry.index)).size;
  const itemTags = item?.tagIds.flatMap(tagId => tags.find(tag => tag.id === tagId)?.name ?? []) ?? [];
  const selectedCollection = collectionName ? collections.find(entry => entry.name === collectionName) ?? { id: "review-staged-collection", name: collectionName } : null;
  const collectionChoices = selectedCollection && !collections.some(entry => entry.id === selectedCollection.id) ? [...collections, selectedCollection] : collections;
  const notifyChanged = () => window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));

  function neighbor(step: number) {
    for (let candidate = index + step; candidate >= 0 && candidate < queue.length; candidate += step) {
      if (availableIds.has(queue[candidate])) return candidate;
    }
    return null;
  }
  function move(step: number) {
    if (inFlight.current) return;
    const next = neighbor(step);
    if (next === null) return;
    setIndex(next); setCollectionName(null); setCollectionInput(""); setTagInput(""); setError(null); setNotice("");
  }

  async function apply(action: () => Promise<UnsortedReviewAction>, message: string, advance: boolean) {
    if (!item || inFlight.current) return false;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const requestedAction = await action();
      const result = await applyUnsortedReviewAction(item.id, requestedAction);
      if (result.undo) setHistory(previous => [...previous.map(entry => ({ ...entry, undo: entry.undo ? rebaseUnsortedReviewUndo(entry.undo, result) : null })), { index, undo: result.undo, notice: message }]);
      setNotice(result.undo ? message : requestedAction.kind === "remove-tag" ? "This tag is no longer on the item." : "This tag is already on the item.");
      if (advance) { setIndex(neighbor(1) ?? queue.length); setCollectionName(null); setCollectionInput(""); setTagInput(""); }
      notifyChanged();
      return true;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Couldn't update this item. Try again."); return false; }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function undo() {
    const previous = history.at(-1);
    if (!previous || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const result = previous.undo ? await undoUnsortedReviewAction(previous.undo) : null;
      setHistory(entries => entries.slice(0, -1).map(entry => ({ ...entry, undo: entry.undo && result ? rebaseUnsortedReviewUndo(entry.undo, result) : entry.undo })));
      setIndex(previous.index); setCollectionName(null); setCollectionInput(""); setTagInput("");
      setNotice("Undone. Returned to the same review position.");
      notifyChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Couldn't undo this action. Try again."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const chooseCollection = (name: string) => { setCollectionName(name); setCollectionInput(""); };
  const clearCollection = () => { setCollectionName(null); setCollectionInput(""); };
  const browseButton = (label: string) => <button type="button" disabled={busy} className="min-h-7 rounded-control px-2 text-xs font-medium text-text-secondary hover:bg-bg-raised hover:text-text-primary">{label}</button>;
  const addTag = (name: string) => void apply(async () => ({ kind: "tag", tagId: (await createTag({ name })).id }), "Tag added. The item stays in Unsorted.", false);
  const removeTag = (tagId: string) => void apply(async () => ({ kind: "remove-tag", tagId }), "Tag removed. The item stays in Unsorted.", false);
  const organization = item ? <ScrollPanel className="library-review-organizer flex min-h-0 flex-col" viewportClassName="min-h-0 flex-1 overscroll-contain" viewportProps={{ "data-preview-scroll": "" }} aria-label="Organize this item" role="group" aria-busy={busy}>
    <CaptureOrgPanel key={item.id} variant="review" disabled={busy}
      collectionName={collectionName} collectionInput={collectionInput} collectionSuggestions={collections}
      tagNames={itemTags} tagInput={tagInput} tagSuggestions={tags}
      collectionInputLabel="Review collection" tagInputLabel="Review tags"
      onCollectionInputChange={setCollectionInput} onSetCollection={chooseCollection} onClearCollection={clearCollection}
      onTagInputChange={setTagInput} onAddTag={addTag} onRemoveTag={name => { const tag = tags.find(entry => entry.name === name); if (tag) removeTag(tag.id); }}
      collectionBrowseControl={<OrganizationMenu kind="collections" entries={collectionChoices} assignedIds={selectedCollection ? [selectedCollection.id] : []} busy={busy} error={error} onSelect={chooseCollection} onClear={clearCollection} trigger={browseButton("Browse all folders")} />}
      tagBrowseControl={<OrganizationMenu kind="tags" entries={tags} assignedIds={item.tagIds} busy={busy} error={error} onSelect={addTag} onRemove={removeTag} trigger={browseButton("Browse all tags")} />}
    />
    <p className="sr-only">Choose a collection, then Apply changes to save and advance. Tags apply immediately.</p>
  </ScrollPanel> : null;
  const footer = <div aria-busy={busy}>
    <div className="library-review-controls">
      <div className="library-review-navigation" role="group" aria-label="Review navigation">
        <button type="button" className="ui-control inline-flex min-h-11 items-center justify-center gap-2 ps-2 pe-3 text-sm disabled:opacity-50" aria-label="Previous item" disabled={busy || neighbor(-1) === null} onClick={() => move(-1)}><ArrowLeftIcon className="size-4 rtl:rotate-180" />Back</button>
        <button type="button" className="ui-control inline-flex min-h-11 items-center justify-center gap-2 ps-3 pe-2 text-sm disabled:opacity-50" aria-label="Next item" title="Next item" disabled={busy || neighbor(1) === null} onClick={() => move(1)}>Next<ArrowRightIcon className="size-4 rtl:rotate-180" /></button>
      </div>
      <div className="library-review-confirm">
        {item ? <button type="button" disabled={busy || !collectionName} className="library-review-file ui-control ui-primary inline-flex min-h-11 items-center justify-center gap-2 ps-2 pe-3 text-sm font-medium disabled:opacity-60"
          onClick={() => {
            if (collectionName) void apply(async () => ({ kind: "file", collectionId: (await createCollection({ name: collectionName })).id }), "Filed in a collection.", true);
          }}><CheckIcon className="size-4" strokeWidth={3} />Apply changes</button> : null}
        {done ? <button type="button" disabled={busy} className="library-review-file ui-control ui-primary inline-flex min-h-11 items-center justify-center gap-2 ps-2 pe-3 text-sm font-medium disabled:opacity-60" onClick={onClose}><ArrowLeftIcon className="size-4 rtl:rotate-180" />Back to Unsorted</button> : null}
      </div>
      <div className="library-review-actions" role="group" aria-label="Item actions">
        <button type="button" disabled={busy || history.length === 0} className="ui-control inline-flex min-h-11 items-center justify-center gap-2 ps-2 pe-3 text-sm disabled:opacity-50" title={history.at(-1)?.notice} onClick={() => void undo()}><UndoIcon className="size-4 rtl:rotate-180" />Undo</button>
        {item ? <button ref={deleteTrigger} type="button" disabled={busy} className={`library-review-delete ui-control inline-flex min-h-11 items-center justify-center gap-2 ps-2 pe-3 text-sm font-medium disabled:opacity-60 ${SHELL_DESTRUCTIVE_BTN}`} title="Move this item to Trash" onClick={() => { setError(null); setDeleteTarget(item); }}><DeleteIcon className="size-4" />Delete</button> : null}
      </div>
    </div>
    <p role="status" aria-live="polite" className="sr-only">{notice}</p>
    {error && !deleteTarget ? <p role="alert" className="mt-2 text-sm text-text-danger">{error}</p> : null}
    <ConfirmDialog open={deleteTarget !== null} title="Move to Trash?"
      description={`Move “${deleteTarget?.title || "this item"}” to Trash? You can restore it later.`}
      confirmLabel="Move to Trash" pendingLabel="Moving…" busy={busy} error={error}
      cancelRef={deleteCancel} returnFocusRef={deleteTrigger}
      onOpenChange={open => { if (!open && !inFlight.current) setDeleteTarget(null); }}
      onConfirm={() => void apply(async () => ({ kind: "delete" }), "Moved to Trash.", true).then(success => { if (success) setDeleteTarget(null); })}
    />
  </div>;
  return <LibraryQuickPreview item={item} index={index} count={queue.length} onMove={move} onClose={() => { if (!inFlight.current) onClose(); }} onOpenItem={(entry, animate) => { if (!inFlight.current) startTransition(() => { onClose(); onOpenItem(entry, animate, true); }); }} returnFocus={returnFocus}
    review={{ footer, organization, busy, progress: <p role="status" aria-live="polite" className="library-review-progress rounded-full border border-border-edge bg-transparent px-2.5 py-1 text-center text-xs tabular-nums text-text-secondary">{done ? <>{reviewedCount} of {queue.length}<span className="sr-only"> reviewed</span></> : <><span className="sr-only">Item </span>{index + 1} of {queue.length}<span className="sr-only"> · {reviewedCount} reviewed</span></>}</p>, emptyState: <div className="max-w-prose space-y-3 text-sm text-text-secondary"><h2 className="text-lg font-semibold text-text-primary">{queue.length === 0 ? "Nothing to review" : done ? reviewedCount === queue.length ? "Review complete" : "End of review" : "This item moved or was deleted"}</h2><p>{done ? "Items you browsed past and items with only tags stay in Unsorted. Use Back to return to them, or start another review whenever you're ready." : "The queue changed in another view. Use Next or Back to continue reviewing."}</p><p>Undo stays available until you close this review.</p></div> }} />;
}
