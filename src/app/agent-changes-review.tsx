"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { ScrollPanel } from "@/components/ui/scroll-panel";
import { Tooltip } from "@/components/ui/tooltip";
import type { StepEffect } from "@/domain/agent-changes";
import { agentDisplayName, effectLabel, effectsByItem, groupEffects, suggestedDecision, type ItemDecision } from "@/domain/agent-review";
import { nameIndex } from "@/domain/agent-tools";
import type { Collection } from "@/domain/collection";
import type { Item } from "@/domain/item";
import type { Tag } from "@/domain/tag";
import {
  AGENT_CHANGES_CHANNEL, applyAgentItemDecision, applyAgentProposal, listOpenProposals, previewAgentProposal, rejectAgentProposal, reopenAgentItem,
} from "@/persistence/agent-changes";
import { CaptureOrgPanel } from "./capture-org-panel";
import { captureStyles } from "./capture-styles";
import { OrganizationMenu } from "./item-context-menu";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { LibraryQuickPreview } from "./library-quick-preview";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, UndoIcon } from "./shell-icons";

type Props = {
  collections: Collection[];
  tags: Tag[];
  onClose: () => void;
  onOpenItem: (item: Item, animate?: boolean) => void;
  returnFocus: () => HTMLElement | null;
};

type Loaded = {
  proposalId: string;
  agentName: string;
  queue: string[];
  items: Record<string, Item>;
  effects: Map<string, StepEffect[]>;
  reasons: Map<string, string[]>;
  /** Suggestions that aren't about one item, like renaming a collection or saving a new link. */
  other: string[];
};

type HistoryEntry = { index: number; itemId: string; changeId?: string };

async function load(): Promise<Loaded | null> {
  const [proposal] = await listOpenProposals();
  if (!proposal) return null;
  const preview = await previewAgentProposal(proposal.id);
  if (!preview) return null;
  const groups = groupEffects(preview.steps);
  const effects = effectsByItem(groups);
  const reasons = new Map<string, string[]>();
  for (const step of preview.steps) {
    if (!step.reason) continue;
    for (const effect of step.effects) {
      if ("itemId" in effect) reasons.set(effect.itemId, [...new Set([...(reasons.get(effect.itemId) ?? []), step.reason])]);
    }
  }
  const queue = [...effects.keys()].filter((itemId) => !effects.get(itemId)!.some((effect) => effect.kind === "create"));
  return {
    proposalId: proposal.id,
    agentName: agentDisplayName(proposal.agentName),
    queue,
    items: preview.items,
    effects,
    reasons,
    other: groups.filter((group) => group.kind === "rename" || group.kind === "create").map((group) => group.kind === "create" ? `${group.title}: ${group.itemIds.length}` : group.title),
  };
}

type CardsProps = { agentName: string; effects: readonly StepEffect[]; reasons: readonly string[]; decision: ItemDecision; busy: boolean; update(change: Partial<ItemDecision>): void };

export function SuggestionSummary({ agentName, effects, reasons }: Pick<CardsProps, "agentName" | "effects" | "reasons">) {
  return (
    <section className={captureStyles["org-section"]} aria-label={`What ${agentName} suggested`}>
      <p className="text-xs font-medium text-text-secondary">{agentName} suggested</p>
      <p className="text-sm text-text-primary">{effects.map(effectLabel).join(" · ")}</p>
      {reasons.map((reason) => <p key={reason} className="text-xs leading-5 text-text-secondary">“{reason}”</p>)}
    </section>
  );
}

export function NoteSuggestion({ effect, decision, busy, update }: { effect: Extract<StepEffect, { kind: "note" }> } & Pick<CardsProps, "decision" | "busy" | "update">) {
  const before = effect.before.trim();
  const appends = !before || effect.after.startsWith(before);
  const included = decision.note !== null;
  return (
    <section className={captureStyles["org-section"]} aria-label="Suggested note">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-text-secondary">{appends ? "Add to the note" : "Replace the note with"}</p>
        <Button disabled={busy} onClick={() => update({ note: included ? null : effect.after })}>{included ? "Leave out" : "Add note"}</Button>
      </div>
      <p className={`whitespace-pre-wrap text-sm leading-6 ${included ? "text-text-primary" : "text-text-secondary line-through"}`}>{appends ? effect.after.slice(before.length).trim() : effect.after}</p>
    </section>
  );
}

export function TrashSuggestion({ agentName, decision, busy, update }: Pick<CardsProps, "agentName" | "decision" | "busy" | "update">) {
  return (
    <section className={captureStyles["org-section"]} aria-label="Suggested Trash">
      <div className="flex items-center justify-between gap-3">
        <p className={`text-sm ${decision.trash ? "text-text-danger" : "text-text-secondary"}`}>{decision.trash ? `${agentName} suggests moving this to Trash.` : "Keeping this item."}</p>
        <Button variant={decision.trash ? "secondary" : "danger-ghost"} disabled={busy} onClick={() => update({ trash: !decision.trash })}>{decision.trash ? "Keep item" : "Move to Trash"}</Button>
      </div>
    </section>
  );
}

const NAV_BUTTON = "min-h-11 gap-2 text-sm disabled:opacity-50";
const PRIMARY_BUTTON = "library-review-file min-h-11 gap-2 ps-2 pe-3 text-sm font-medium";

export function ReviewFooter({ busy, canBack, canNext, onBack, onNext, primary, canUndo, onUndo, notice, error }: {
  busy: boolean; canBack: boolean; canNext: boolean; onBack(): void; onNext(): void; primary: { label: string; icon: "check" | "back"; onClick(): void } | null;
  canUndo: boolean; onUndo(): void; notice: string; error: string | null;
}) {
  return (
    <div aria-busy={busy}>
      <div className="library-review-controls">
        <div className="library-review-navigation" role="group" aria-label="Review navigation">
          <button type="button" className={buttonClassName({ size: "none", className: `${NAV_BUTTON} ps-2 pe-3` })} aria-label="Previous item" disabled={busy || !canBack} onClick={onBack}><ArrowLeftIcon className="size-4 rtl:rotate-180" />Back</button>
          <Tooltip content="Next item, leaving this one as it is" describe={false}><button type="button" className={buttonClassName({ size: "none", className: `${NAV_BUTTON} ps-3 pe-2` })} aria-label="Next item" disabled={busy || !canNext} onClick={onNext}>Next<ArrowRightIcon className="size-4 rtl:rotate-180" /></button></Tooltip>
        </div>
        <div className="library-review-confirm">
          {primary ? (
            <button type="button" disabled={busy} className={buttonClassName({ variant: "primary", size: "none", className: PRIMARY_BUTTON })} onClick={primary.onClick}>
              {primary.icon === "check" ? <CheckIcon className="size-4" strokeWidth={3} /> : <ArrowLeftIcon className="size-4 rtl:rotate-180" />}{primary.label}
            </button>
          ) : null}
        </div>
        <div className="library-review-actions" role="group" aria-label="Item actions">
          <Tooltip content="Undo the last applied item" disabled={!canUndo}><button type="button" disabled={busy || !canUndo} className={buttonClassName({ size: "none", className: `${NAV_BUTTON} ps-2 pe-3` })} onClick={onUndo}><UndoIcon className="size-4 rtl:rotate-180" />Undo</button></Tooltip>
        </div>
      </div>
      <p role="status" aria-live="polite" className="sr-only">{notice}</p>
      {error ? <p role="alert" className="mt-2 text-sm text-text-danger">{error}</p> : null}
    </div>
  );
}

function EndOfReview({ loaded, total, remaining, busy, onApplyRest, onDeclineRest }: { loaded: Loaded | null | undefined; total: number; remaining: number; busy: boolean; onApplyRest(): void; onDeclineRest(): void }) {
  let heading = "Review complete";
  if (loaded === undefined) heading = "Loading suggestions…";
  else if (!loaded || !total) heading = "Nothing to review";
  else if (remaining) heading = "End of review";
  const open = !!loaded && (remaining > 0 || loaded.other.length > 0);
  return (
    <div className="max-w-prose space-y-3 text-sm text-text-secondary">
      <h2 className="text-lg font-semibold text-text-primary">{heading}</h2>
      {loaded && remaining ? <p>{remaining === 1 ? "1 item was" : `${remaining} items were`} left as they are. Use Back to return to them, or settle the rest at once.</p> : null}
      {loaded?.other.length ? <p>{loaded.agentName} also suggested: {loaded.other.join("; ")}. These apply with the rest.</p> : null}
      {open ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="primary" disabled={busy} onClick={onApplyRest}>Apply the rest as suggested</Button>
          <Button disabled={busy} onClick={onDeclineRest}>Decline the rest</Button>
        </div>
      ) : null}
      <p>Every applied change can be undone in Settings, Agents.</p>
    </div>
  );
}

/**
 * Unsorted review's twin for an agent's suggestions: one item at a time, the same organize panel pre-filled with
 * what the agent suggested, and Apply changes to keep it (as adjusted) and move on.
 */
export function AgentChangesReview({ collections, tags, onClose, onOpenItem, returnFocus }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null | undefined>(undefined);
  const [index, setIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, ItemDecision>>({});
  const [decided, setDecided] = useState<ReadonlySet<string>>(new Set());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [collectionInput, setCollectionInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);

  const refresh = useCallback(() => load().then((next) => setLoaded((current) => {
    // Once everything is settled the proposal closes; keep showing the finished review rather than "nothing to review".
    if (!next) return current ? { ...current, other: [] } : null;
    // Keep the order the reviewer started with; new suggestions join the end.
    if (!current || current.proposalId !== next.proposalId) return next;
    return { ...next, queue: [...current.queue, ...next.queue.filter((id) => !current.queue.includes(id))] };
  }), () => setLoaded(null)), []);

  useEffect(() => {
    void refresh();
    const channel = new BroadcastChannel(AGENT_CHANGES_CHANNEL);
    channel.onmessage = () => {
      if (!inFlight.current) void refresh();
    };
    return () => channel.close();
  }, [refresh]);

  const queue = loaded?.queue ?? [];
  const itemId = queue[index];
  const item = loaded && itemId && !decided.has(itemId) ? loaded.items[itemId] ?? null : null;
  const done = !!loaded && index >= queue.length;
  const names = nameIndex(tags, collections);
  const decision = item ? decisions[item.id] ?? suggestedDecision(item, loaded!.effects.get(item.id) ?? [], names) : null;
  const remaining = queue.filter((id) => !decided.has(id)).length;
  const notify = () => window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));

  function neighbor(step: number) {
    for (let candidate = index + step; candidate >= 0 && candidate < queue.length; candidate += step) {
      if (!decided.has(queue[candidate])) return candidate;
    }
    return null;
  }
  function move(step: number) {
    if (inFlight.current) return;
    const next = neighbor(step);
    if (next === null) return;
    setIndex(next); setCollectionInput(""); setTagInput(""); setError(null); setNotice("");
  }
  function update(change: Partial<ItemDecision>) {
    if (!item || !decision) return;
    setDecisions((current) => ({ ...current, [item.id]: { ...decision, ...change } }));
  }
  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      await action();
      notify();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't update this item. Try again.");
    } finally {
      inFlight.current = false; setBusy(false);
    }
  }
  const applyItem = () => void run(async () => {
    if (!loaded || !item || !decision) return;
    const result = await applyAgentItemDecision(loaded.proposalId, item.id, decision);
    setHistory((entries) => [...entries, { index, itemId: item.id, changeId: result.changeId }]);
    setDecided((current) => new Set([...current, item.id]));
    setNotice(decision.trash ? "Moved to Trash." : "Changes applied.");
    setIndex(neighbor(1) ?? queue.length); setCollectionInput(""); setTagInput("");
  });
  const undo = () => void run(async () => {
    const previous = history.at(-1);
    if (!loaded || !previous) return;
    await reopenAgentItem(loaded.proposalId, previous.itemId, previous.changeId);
    setHistory((entries) => entries.slice(0, -1));
    setDecided((current) => new Set([...current].filter((id) => id !== previous.itemId)));
    setIndex(previous.index); setCollectionInput(""); setTagInput("");
    setNotice("Undone. Returned to the same item.");
  });
  const applyRest = () => void run(async () => {
    if (!loaded) return;
    await applyAgentProposal(loaded.proposalId);
    setDecided(new Set(queue));
    setLoaded({ ...loaded, other: [] });
    setNotice("Applied the rest as suggested.");
  });
  const declineRest = () => void run(async () => {
    if (!loaded) return;
    await rejectAgentProposal(loaded.proposalId);
    setDecided(new Set(queue));
    setLoaded({ ...loaded, other: [] });
    setNotice("Declined the rest. Nothing else changed.");
  });

  const label = `${loaded?.agentName ?? "Agent"}'s changes`;
  const effects = item ? loaded!.effects.get(item.id) ?? [] : [];
  const noteEffect = effects.find((effect): effect is Extract<StepEffect, { kind: "note" }> => effect.kind === "note");
  const suggestedTrash = effects.some((effect) => effect.kind === "trash");
  const browseButton = (text: string) => <button type="button" disabled={busy} className="min-h-7 px-2 text-xs font-medium text-text-secondary hover:bg-bg-raised hover:text-text-primary">{text}</button>;

  const organization = item && decision ? (
    <ScrollPanel className="library-review-organizer flex min-h-0 flex-col" viewportClassName="min-h-0 flex-1 overscroll-contain" viewportProps={{ "data-preview-scroll": "" }} aria-label="Review this item's changes" role="group" aria-busy={busy}>
      <div className="grid gap-3">
        <SuggestionSummary agentName={loaded!.agentName} effects={effects} reasons={loaded!.reasons.get(item.id) ?? []} />
        <CaptureOrgPanel key={item.id} variant="review" disabled={busy || decision.trash}
          collectionName={decision.collection} collectionInput={collectionInput} collectionSuggestions={collections}
          tagNames={decision.tags} tagInput={tagInput} tagSuggestions={tags}
          collectionInputLabel="Review collection" tagInputLabel="Review tags"
          onCollectionInputChange={setCollectionInput}
          onSetCollection={(name) => { update({ collection: name }); setCollectionInput(""); }}
          onClearCollection={() => { update({ collection: null }); setCollectionInput(""); }}
          onTagInputChange={setTagInput}
          onAddTag={(name) => { if (!decision.tags.includes(name)) update({ tags: [...decision.tags, name] }); setTagInput(""); }}
          onRemoveTag={(name) => update({ tags: decision.tags.filter((tag) => tag !== name) })}
          collectionBrowseControl={<OrganizationMenu kind="collections" entries={collections} assignedIds={collections.filter((entry) => entry.name === decision.collection).map((entry) => entry.id)} busy={busy} error={error} onSelect={(name) => update({ collection: name })} onClear={() => update({ collection: null })} trigger={browseButton("Browse all folders")} />}
          tagBrowseControl={<OrganizationMenu kind="tags" entries={tags} assignedIds={tags.filter((entry) => decision.tags.includes(entry.name)).map((entry) => entry.id)} busy={busy} error={error} onSelect={(name) => update({ tags: [...new Set([...decision.tags, name])] })} onRemove={(tagId) => update({ tags: decision.tags.filter((tag) => tag !== tags.find((entry) => entry.id === tagId)?.name) })} trigger={browseButton("Browse all tags")} />}
        />
        {noteEffect ? <NoteSuggestion effect={noteEffect} decision={decision} busy={busy} update={update} /> : null}
        {suggestedTrash ? <TrashSuggestion agentName={loaded!.agentName} decision={decision} busy={busy} update={update} /> : null}
      </div>
      <p className="sr-only">Adjust the collection and tags, then Apply changes to save and advance. Next leaves the item as it is.</p>
    </ScrollPanel>
  ) : null;

  let primary: { label: string; icon: "check" | "back"; onClick(): void } | null = null;
  if (item) primary = { label: decision?.trash ? "Move to Trash" : "Apply changes", icon: "check", onClick: applyItem };
  else if (done) primary = { label: "Back to library", icon: "back", onClick: onClose };
  const footer = (
    <ReviewFooter busy={busy} canBack={neighbor(-1) !== null} canNext={neighbor(1) !== null} onBack={() => move(-1)} onNext={() => move(1)}
      primary={primary} canUndo={history.length > 0} onUndo={undo} notice={notice} error={error} />
  );

  const emptyState = <EndOfReview loaded={loaded} total={queue.length} remaining={remaining} busy={busy} onApplyRest={applyRest} onDeclineRest={declineRest} />;

  return (
    <LibraryQuickPreview item={item} index={index} count={queue.length} onMove={move}
      onClose={() => { if (!inFlight.current) onClose(); }}
      onOpenItem={(entry, animate) => { if (!inFlight.current) { onClose(); onOpenItem(entry, animate); } }}
      returnFocus={returnFocus}
      review={{
        footer, organization, busy, emptyState, label,
        description: "Review an agent's changes. Left and right arrows browse items. Adjust the collection and tags, then Apply changes. Next leaves the item as it is. Escape closes review.",
        progress: <p role="status" aria-live="polite" className="rounded-full border border-border-edge bg-transparent px-2.5 py-1 text-center text-xs tabular-nums text-text-secondary">{done ? <>{queue.length - remaining} of {queue.length}<span className="sr-only"> reviewed</span></> : <><span className="sr-only">Item </span>{index + 1} of {queue.length}</>}</p>,
      }}
    />
  );
}
