"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { ScrollPanel } from "@/components/ui/scroll-panel";
import { Tooltip } from "@/components/ui/tooltip";
import type { StepEffect } from "@/domain/agent-changes";
import { agentDisplayName, effectsByItem, groupEffects, suggestedDecision, type ItemDecision } from "@/domain/agent-review";
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
import { PendingFileContent, pendingFileIds } from "./pending-file-preview";
import { registerVideoPosterMaker } from "@/persistence/agent-files";
import { prepareLocalVideo } from "./prepare-local-video";
import { LibraryQuickPreview } from "./library-quick-preview";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, UndoIcon } from "./shell-icons";
import { useTranslations, type Translations } from "@/i18n/use-translations";


// Videos saved from a review get a poster frame, as Add files gives them.
registerVideoPosterMaker(prepareLocalVideo);
type Props = {
  collections: Collection[];
  tags: Tag[];
  onClose: () => void;
  onOpenItem: (item: Item, animate?: boolean) => void;
  returnFocus: () => HTMLElement | null;
  /** Start at this item, for reviewing from a tile on the overview page. */
  startItemId?: string;
};

type Loaded = {
  proposalId: string;
  agentName: string;
  queue: string[];
  items: Record<string, Item>;
  effects: Map<string, StepEffect[]>;
  reasons: Map<string, string[]>;
  /** Collection and tag names by ID, including ones the suggestions would create. */
  names: { collections: Map<string, string>; tags: Map<string, string> };
  /** Items the suggestions would save. They aren't in the library until applied. */
  created: ReadonlySet<string>;
  /** Suggestions that aren't about one item, like renaming a collection. */
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
  const queue = [...effects.keys()];
  const created = new Set(queue.filter((itemId) => effects.get(itemId)!.some((effect) => effect.kind === "create")));
  return {
    proposalId: proposal.id,
    agentName: agentDisplayName(proposal.agentName),
    queue,
    items: preview.items,
    effects,
    reasons,
    names: { collections: new Map(Object.entries(preview.names.collections)), tags: new Map(Object.entries(preview.names.tags)) },
    created,
    other: groups.filter((group) => group.kind === "rename").map((group) => group.title),
  };
}

type CardsProps = { agentName: string; effects: readonly StepEffect[]; reasons: readonly string[]; decision: ItemDecision; busy: boolean; update(change: Partial<ItemDecision>): void };

/** One suggested change as a short label: "→ Portfolio", "+ design", "Trash". */
function effectLabel(t: Translations<"Review">, effect: StepEffect): string {
  switch (effect.kind) {
    case "collection": return effect.to ? t("effects.collection", { name: effect.to }) : t("effects.unsorted");
    case "tag": return t(effect.op === "add" ? "effects.tagAdd" : "effects.tagRemove", { tag: effect.tag });
    case "note": return t("effects.note");
    case "trash": return t("effects.trash");
    case "rename": return t("effects.rename", { from: effect.from, to: effect.to });
    case "create": return t("effects.create");
  }
}

export function SuggestionSummary({ agentName, effects, reasons }: Pick<CardsProps, "agentName" | "effects" | "reasons">) {
  const t = useTranslations("Review");
  return (
    <section className={captureStyles["org-section"]} aria-label={t("suggestedLabel", { agent: agentName })}>
      <p className="text-xs font-medium text-text-secondary">{t("suggestedBy", { agent: agentName })}</p>
      <p className="text-sm text-text-primary">{effects.map((effect) => effectLabel(t, effect)).join(" · ")}</p>
      {reasons.map((reason) => <p key={reason} className="text-xs leading-5 text-text-secondary">{t("quoted", { text: reason })}</p>)}
    </section>
  );
}

export function NoteSuggestion({ effect, decision, busy, update }: { effect: Extract<StepEffect, { kind: "note" }> } & Pick<CardsProps, "decision" | "busy" | "update">) {
  const before = effect.before.trim();
  const appends = !before || effect.after.startsWith(before);
  const included = decision.note !== null;
  const t = useTranslations("Review");
  return (
    <section className={captureStyles["org-section"]} aria-label={t("suggestedNote")}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-text-secondary">{appends ? t("addToNote") : t("replaceNote")}</p>
        <Button disabled={busy} onClick={() => update({ note: included ? null : effect.after })}>{included ? t("leaveOut") : t("addNote")}</Button>
      </div>
      <p className={`whitespace-pre-wrap text-sm leading-6 ${included ? "text-text-primary" : "text-text-secondary line-through"}`}>{appends ? effect.after.slice(before.length).trim() : effect.after}</p>
    </section>
  );
}

export function TrashSuggestion({ agentName, decision, busy, update }: Pick<CardsProps, "agentName" | "decision" | "busy" | "update">) {
  const t = useTranslations("Review");
  return (
    <section className={captureStyles["org-section"]} aria-label={t("suggestedTrash")}>
      <div className="flex items-center justify-between gap-3">
        <p className={`text-sm ${decision.trash ? "text-text-danger" : "text-text-secondary"}`}>{decision.trash ? t("agentSuggestsTrash", { agent: agentName }) : t("keepingItem")}</p>
        <Button variant={decision.trash ? "secondary" : "danger-ghost"} disabled={busy} onClick={() => update({ trash: !decision.trash })}>{decision.trash ? t("keepItem") : t("moveToTrash")}</Button>
      </div>
    </section>
  );
}

/** A new item the agent wants to save. It isn't in the library yet; "Don't save" leaves it out. */
export function NewItemSuggestion({ agentName, decision, busy, update }: Pick<CardsProps, "agentName" | "decision" | "busy" | "update">) {
  const t = useTranslations("Review");
  return (
    <section className={captureStyles["org-section"]} aria-label={t("newItem")}>
      <div className="flex items-center justify-between gap-3">
        <p className={`text-sm ${decision.trash ? "text-text-secondary line-through" : "text-text-primary"}`}>{decision.trash ? t("wontBeSaved") : t("newFrom", { agent: agentName })}</p>
        <Button variant={decision.trash ? "secondary" : "danger-ghost"} disabled={busy} onClick={() => update({ trash: !decision.trash })}>{decision.trash ? t("saveIt") : t("dontSave")}</Button>
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
  const t = useTranslations("Review");
  return (
    <div aria-busy={busy}>
      <div className="library-review-controls">
        <div className="library-review-navigation" role="group" aria-label={t("navigation")}>
          <button type="button" className={buttonClassName({ size: "none", className: `${NAV_BUTTON} ps-2 pe-3` })} aria-label={t("previousItem")} disabled={busy || !canBack} onClick={onBack}><ArrowLeftIcon className="size-4 rtl:rotate-180" />{t("back")}</button>
          <Tooltip content={t("nextLeaving")} describe={false}><button type="button" className={buttonClassName({ size: "none", className: `${NAV_BUTTON} ps-3 pe-2` })} aria-label={t("nextItem")} disabled={busy || !canNext} onClick={onNext}>{t("next")}<ArrowRightIcon className="size-4 rtl:rotate-180" /></button></Tooltip>
        </div>
        <div className="library-review-confirm">
          {primary ? (
            <button type="button" disabled={busy} className={buttonClassName({ variant: "primary", size: "none", className: PRIMARY_BUTTON })} onClick={primary.onClick}>
              {primary.icon === "check" ? <CheckIcon className="size-4" strokeWidth={3} /> : <ArrowLeftIcon className="size-4 rtl:rotate-180" />}{primary.label}
            </button>
          ) : null}
        </div>
        <div className="library-review-actions" role="group" aria-label={t("itemActions")}>
          <Tooltip content={t("undoLast")} disabled={!canUndo}><button type="button" disabled={busy || !canUndo} className={buttonClassName({ size: "none", className: `${NAV_BUTTON} ps-2 pe-3` })} onClick={onUndo}><UndoIcon className="size-4 rtl:rotate-180" />{t("undo")}</button></Tooltip>
        </div>
      </div>
      <p role="status" aria-live="polite" className="sr-only">{notice}</p>
      {error ? <p role="alert" className="mt-2 text-sm text-text-danger">{error}</p> : null}
    </div>
  );
}

function EndOfReview({ loaded, total, remaining, busy, onApplyRest, onDeclineRest }: { loaded: Loaded | null | undefined; total: number; remaining: number; busy: boolean; onApplyRest(): void; onDeclineRest(): void }) {
  const t = useTranslations("Review");
  let heading = t("complete");
  if (loaded === undefined) heading = t("loading");
  else if (!loaded || !total) heading = t("nothing");
  else if (remaining) heading = t("end");
  const open = !!loaded && (remaining > 0 || loaded.other.length > 0);
  return (
    <div className="max-w-prose space-y-3 text-sm text-text-secondary">
      <h2 className="text-lg font-semibold text-text-primary">{heading}</h2>
      {loaded && remaining ? <p>{t("remainingLeft", { count: remaining })}</p> : null}
      {loaded?.other.length ? <p>{t("alsoSuggested", { agent: loaded.agentName, list: loaded.other.join("; ") })}</p> : null}
      {open ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="primary" disabled={busy} onClick={onApplyRest}>{t("applyRest")}</Button>
          <Button disabled={busy} onClick={onDeclineRest}>{t("declineRest")}</Button>
        </div>
      ) : null}
      <p>{t("undoInSettings")}</p>
    </div>
  );
}

/**
 * Unsorted review's twin for an agent's suggestions: one item at a time, the same organize panel pre-filled with
 * what the agent suggested, and Apply changes to keep it (as adjusted) and move on.
 */
export function AgentChangesReview({ collections, tags, onClose, onOpenItem, returnFocus, startItemId }: Props) {
  const t = useTranslations("Review");
  const [loaded, setLoaded] = useState<Loaded | null | undefined>(undefined);
  // Until the reviewer moves, the position follows the item they opened the review on.
  const [chosenIndex, setIndex] = useState<number | null>(null);
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
  const index = chosenIndex ?? Math.max(0, startItemId ? queue.indexOf(startItemId) : 0);
  const itemId = queue[index];
  const item = loaded && itemId && !decided.has(itemId) ? loaded.items[itemId] ?? null : null;
  const done = !!loaded && index >= queue.length;
  const names = loaded?.names ?? nameIndex(tags, collections);
  const isNew = !!item && !!loaded?.created.has(item.id);
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
      setError(caught instanceof Error ? caught.message : t("updateFailed"));
    } finally {
      inFlight.current = false; setBusy(false);
    }
  }
  const applyItem = () => void run(async () => {
    if (!loaded || !item || !decision) return;
    const result = await applyAgentItemDecision(loaded.proposalId, item.id, decision);
    setHistory((entries) => [...entries, { index, itemId: item.id, changeId: result.changeId }]);
    setDecided((current) => new Set([...current, item.id]));
    setNotice(isNew ? (decision.trash ? t("notSaved") : t("savedToLibrary")) : decision.trash ? t("movedToTrash") : t("changesApplied"));
    setIndex(neighbor(1) ?? queue.length); setCollectionInput(""); setTagInput("");
  });
  const undo = () => void run(async () => {
    const previous = history.at(-1);
    if (!loaded || !previous) return;
    await reopenAgentItem(loaded.proposalId, previous.itemId, previous.changeId);
    setHistory((entries) => entries.slice(0, -1));
    setDecided((current) => new Set([...current].filter((id) => id !== previous.itemId)));
    setIndex(previous.index); setCollectionInput(""); setTagInput("");
    setNotice(t("undoneSameItem"));
  });
  const applyRest = () => void run(async () => {
    if (!loaded) return;
    await applyAgentProposal(loaded.proposalId);
    setDecided(new Set(queue));
    setLoaded({ ...loaded, other: [] });
    setNotice(t("appliedRest"));
  });
  const declineRest = () => void run(async () => {
    if (!loaded) return;
    await rejectAgentProposal(loaded.proposalId);
    setDecided(new Set(queue));
    setLoaded({ ...loaded, other: [] });
    setNotice(t("declinedRest"));
  });

  const label = t("agentChanges", { agent: loaded?.agentName ?? t("agentFallback") });
  const effects = item ? loaded!.effects.get(item.id) ?? [] : [];
  const noteEffect = effects.find((effect): effect is Extract<StepEffect, { kind: "note" }> => effect.kind === "note");
  const suggestedTrash = effects.some((effect) => effect.kind === "trash");
  const browseButton = (text: string) => <button type="button" disabled={busy} className="min-h-7 px-2 text-xs font-medium text-text-secondary hover:bg-bg-raised hover:text-text-primary">{text}</button>;

  const organization = item && decision ? (
    <ScrollPanel className="library-review-organizer flex min-h-0 flex-col" viewportClassName="min-h-0 flex-1 overscroll-contain" viewportProps={{ "data-preview-scroll": "" }} aria-label={t("reviewItemChanges")} role="group" aria-busy={busy}>
      <div className="grid gap-3">
        <SuggestionSummary agentName={loaded!.agentName} effects={effects} reasons={loaded!.reasons.get(item.id) ?? []} />
        {isNew ? <NewItemSuggestion agentName={loaded!.agentName} decision={decision} busy={busy} update={update} /> : null}
        <CaptureOrgPanel key={item.id} variant="review" disabled={busy || decision.trash}
          collectionName={decision.collection} collectionInput={collectionInput} collectionSuggestions={collections}
          tagNames={decision.tags} tagInput={tagInput} tagSuggestions={tags}
          collectionInputLabel={t("reviewCollection")} tagInputLabel={t("reviewTags")}
          onCollectionInputChange={setCollectionInput}
          onSetCollection={(name) => { update({ collection: name }); setCollectionInput(""); }}
          onClearCollection={() => { update({ collection: null }); setCollectionInput(""); }}
          onTagInputChange={setTagInput}
          onAddTag={(name) => { if (!decision.tags.includes(name)) update({ tags: [...decision.tags, name] }); setTagInput(""); }}
          onRemoveTag={(name) => update({ tags: decision.tags.filter((tag) => tag !== name) })}
          collectionBrowseControl={<OrganizationMenu kind="collections" entries={collections} assignedIds={collections.filter((entry) => entry.name === decision.collection).map((entry) => entry.id)} busy={busy} error={error} onSelect={(name) => update({ collection: name })} onClear={() => update({ collection: null })} trigger={browseButton(t("browseFolders"))} />}
          tagBrowseControl={<OrganizationMenu kind="tags" entries={tags} assignedIds={tags.filter((entry) => decision.tags.includes(entry.name)).map((entry) => entry.id)} busy={busy} error={error} onSelect={(name) => update({ tags: [...new Set([...decision.tags, name])] })} onRemove={(tagId) => update({ tags: decision.tags.filter((tag) => tag !== tags.find((entry) => entry.id === tagId)?.name) })} trigger={browseButton(t("browseTags"))} />}
        />
        {noteEffect ? <NoteSuggestion effect={noteEffect} decision={decision} busy={busy} update={update} /> : null}
        {suggestedTrash ? <TrashSuggestion agentName={loaded!.agentName} decision={decision} busy={busy} update={update} /> : null}
      </div>
      <p className="sr-only">{t("agentHint")}</p>
    </ScrollPanel>
  ) : null;

  let primary: { label: string; icon: "check" | "back"; onClick(): void } | null = null;
  if (item) primary = { label: decision?.trash ? (isNew ? t("dontSave") : t("moveToTrash")) : isNew ? t("saveToLibrary") : t("applyChanges"), icon: "check", onClick: applyItem };
  else if (done) primary = { label: t("backToLibrary"), icon: "back", onClick: onClose };
  const footer = (
    <ReviewFooter busy={busy} canBack={neighbor(-1) !== null} canNext={neighbor(1) !== null} onBack={() => move(-1)} onNext={() => move(1)}
      primary={primary} canUndo={history.length > 0} onUndo={undo} notice={notice} error={error} />
  );

  const emptyState = <EndOfReview loaded={loaded} total={queue.length} remaining={remaining} busy={busy} onApplyRest={applyRest} onDeclineRest={declineRest} />;

  return (
    <LibraryQuickPreview item={item} index={index} count={queue.length} onMove={move}
      onClose={() => { if (!inFlight.current) onClose(); }}
      // A new item has no page until it's saved.
      onOpenItem={(entry, animate) => { if (!inFlight.current && !loaded?.created.has(entry.id)) { onClose(); onOpenItem(entry, animate); } }}
      returnFocus={returnFocus}
      review={{
        footer, organization, busy, emptyState, label,
        content: item && isNew && pendingFileIds(item) ? <PendingFileContent item={item} /> : undefined,
        description: t("agentDescription"),
        progress: <p role="status" aria-live="polite" className="rounded-full border border-border-edge bg-transparent px-2.5 py-1 text-center text-xs tabular-nums text-text-secondary">{done
          ? t.rich("reviewedProgress", { done: queue.length - remaining, total: queue.length, sr: (chunks) => <span className="sr-only">{chunks}</span> })
          : t.rich("itemProgress", { index: index + 1, total: queue.length, sr: (chunks) => <span className="sr-only">{chunks}</span> })}</p>,
      }}
    />
  );
}
