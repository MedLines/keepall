"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { StepEffect } from "@/domain/agent-changes";
import { effectLabel, effectsByItem, reviewSummary, type ReviewGroup } from "@/domain/agent-review";
import { itemListTitle, type Item } from "@/domain/item";
import { cn } from "@/lib/utils";
import { itemPageHref } from "../item-page-navigation";
import { LibraryItemMedia } from "../library-item-media";
import { LibraryQuickPreview } from "../library-quick-preview";
import { ArrowLeftIcon, NoteIcon } from "../shell-icons";

export type ReviewView = "changes" | "items";

export type AgentReviewPanelProps = {
  agentName: string;
  createdAt: number;
  now: number;
  groups: ReviewGroup[];
  items: Record<string, Item>;
  /** Suggestions that can't apply as they stand, in words. */
  conflicts: string[];
  /** Effect keys the reviewer unticked. */
  excluded: ReadonlySet<string>;
  view: ReviewView;
  backupFolder: boolean;
  busy: boolean;
  onView(view: ReviewView): void;
  onToggle(keys: readonly string[], include: boolean): void;
  onApply(): void;
  onDecline(): void;
};

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function ago(time: number, now: number) {
  const minutes = Math.round((time - now) / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  return Math.abs(hours) < 24 ? relative.format(hours, "hour") : relative.format(Math.round(hours / 24), "day");
}

function count(value: number, word: string) {
  return `${value} ${word}${value === 1 ? "" : "s"}`;
}

/** Images saved from the web are titled by their site, which says nothing in a grid of them; use the caption. */
function title(item: Item | undefined) {
  if (!item) return "Untitled";
  if (item.type === "image") return item.caption.trim() || "Image";
  return itemListTitle(item) || "Untitled";
}

type Preview = (ids: readonly string[], itemId: string, from: HTMLElement) => void;

/** A plain click opens the quick look; modified clicks keep the link's own behavior, like a new tab. */
function previewClick(preview: Preview, ids: readonly string[], itemId: string) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    preview(ids, itemId, event.currentTarget);
  };
}

/** A checkbox that can show "some" for a group with a mix of ticked and unticked items. */
function GroupCheckbox({ keys, excluded, onToggle, labelledBy }: { keys: readonly string[]; excluded: ReadonlySet<string>; onToggle: AgentReviewPanelProps["onToggle"]; labelledBy: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const off = keys.filter((key) => excluded.has(key)).length;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = off > 0 && off < keys.length;
  }, [off, keys.length]);
  return <input ref={ref} type="checkbox" className="mt-1.5" aria-labelledby={labelledBy} checked={off === 0} onChange={(event) => onToggle(keys, event.target.checked)} />;
}

/** The item's own picture, or for a note its first lines. Saved items open in Keepall's viewer. */
function Thumbnail({ item }: { item: Item }) {
  if (item.type === "note") {
    return (
      <span className="flex size-full flex-col justify-between p-3 text-left">
        <span className="line-clamp-5 text-xs leading-5 text-text-primary">{item.title || item.content}</span>
        <NoteIcon className="size-4 text-text-secondary" />
      </span>
    );
  }
  return <LibraryItemMedia item={item} variant="card" sharedTransition={false} />;
}

function Tile({ item, itemId, keys, excluded, onToggle, saved, preview, siblings }: {
  item: Item | undefined; itemId: string; keys: readonly string[]; excluded: ReadonlySet<string>; onToggle: AgentReviewPanelProps["onToggle"]; saved: boolean;
  preview: Preview; siblings: readonly string[];
}) {
  const included = keys.some((key) => !excluded.has(key));
  const name = title(item);
  const media = item ? <Thumbnail item={item} /> : null;
  return (
    <li className="min-w-0">
      <div className={cn("relative aspect-square overflow-hidden rounded-control-lg border border-border-control bg-bg-raised", !included && "opacity-(--opacity-disabled)")}>
        {saved && item
          ? <Link href={itemPageHref(itemId, "/")} className="block size-full" aria-label={`Look at “${name}”`} onClick={previewClick(preview, siblings, itemId)}>{media}</Link>
          : media}
        <label className="absolute left-2 top-2 flex rounded-control-xs border border-border-control bg-bg-surface p-1.5">
          <input type="checkbox" checked={included} aria-label={`Include “${name}”`} onChange={(event) => onToggle(keys, event.target.checked)} />
        </label>
      </div>
      <p className="mt-1.5 truncate text-xs text-text-secondary">{name}</p>
    </li>
  );
}

function NoteRow({ effect, item, excluded, onToggle, preview, siblings }: {
  effect: Extract<StepEffect, { kind: "note" }>; item: Item | undefined; excluded: ReadonlySet<string>; onToggle: AgentReviewPanelProps["onToggle"]; preview: Preview; siblings: readonly string[];
}) {
  const before = effect.before.trim();
  const appended = before && effect.after.startsWith(before);
  const added = appended ? effect.after.slice(before.length).trim() : effect.after;
  return (
    <li className={cn("flex gap-3 border-t border-border-control pt-4 first:border-t-0 first:pt-0", excluded.has(effect.key) && "opacity-(--opacity-disabled)")}>
      <input type="checkbox" className="mt-1.5" checked={!excluded.has(effect.key)} aria-label={`Include the note on “${title(item)}”`} onChange={(event) => onToggle([effect.key], event.target.checked)} />
      <div className="size-16 shrink-0 overflow-hidden rounded-control-md border border-border-control bg-bg-raised">{item ? <Thumbnail item={item} /> : null}</div>
      <div className="min-w-0 flex-1 text-sm leading-6">
        {item ? <Link href={itemPageHref(effect.itemId, "/")} onClick={previewClick(preview, siblings, effect.itemId)} className="font-medium text-text-primary underline-offset-2 hover:underline">{title(item)}</Link> : null}
        {before && appended ? <p className="mt-1 line-clamp-2 text-text-secondary">{before}</p> : null}
        {before && !appended ? <p className="mt-1 line-clamp-2 text-text-danger line-through">{before}</p> : null}
        <p className="mt-1 whitespace-pre-wrap rounded-control-xs bg-bg-selected px-2 py-1 text-text-primary">{added}</p>
      </div>
    </li>
  );
}

function Group({ group, items, excluded, onToggle, preview }: { group: ReviewGroup; preview: Preview } & Pick<AgentReviewPanelProps, "items" | "excluded" | "onToggle">) {
  const headingId = `group-${group.id}`;
  const keys = group.effects.map((effect) => effect.key);
  const chosen = keys.filter((key) => !excluded.has(key)).length;
  const keysFor = (itemId: string) => group.effects.filter((effect) => "itemId" in effect && effect.itemId === itemId).map((effect) => effect.key);
  return (
    <section aria-labelledby={headingId} className="library-panel border border-border-control bg-bg-surface p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <GroupCheckbox keys={keys} excluded={excluded} onToggle={onToggle} labelledBy={headingId} />
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className={cn("text-base font-semibold", group.caution ? "text-text-danger" : "text-text-primary")}>{group.title}</h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            {group.itemIds.length ? count(group.itemIds.length, "item") : count(group.effects.length, "change")}
            {chosen < keys.length ? ` · ${chosen} included` : ""}
          </p>
          {group.reasons.map((reason) => <p key={reason} className="mt-2 text-sm leading-6 text-text-secondary">“{reason}”</p>)}
        </div>
      </div>
      {group.kind === "note" ? (
        <ul className="mt-4 space-y-4">
          {group.effects.map((effect) => effect.kind === "note" ? <NoteRow key={effect.key} effect={effect} item={items[effect.itemId]} excluded={excluded} onToggle={onToggle} preview={preview} siblings={group.itemIds} /> : null)}
        </ul>
      ) : group.itemIds.length ? (
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {group.itemIds.map((itemId) => (
            <Tile key={itemId} itemId={itemId} item={items[itemId]} keys={keysFor(itemId)} excluded={excluded} onToggle={onToggle} saved={group.kind !== "create"} preview={preview} siblings={group.itemIds} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function EffectChips({ effects, excluded, onToggle }: { effects: readonly StepEffect[] } & Pick<AgentReviewPanelProps, "excluded" | "onToggle">) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {effects.map((effect) => (
        <label key={effect.key} className={cn("ui-control inline-flex cursor-pointer items-center gap-1.5 px-2.5 py-1 text-xs has-[:checked]:bg-bg-active", effect.kind === "trash" && "text-text-danger")}>
          <input type="checkbox" checked={!excluded.has(effect.key)} onChange={(event) => onToggle([effect.key], event.target.checked)} />
          {effectLabel(effect)}
        </label>
      ))}
    </div>
  );
}

/** Each item once, with every change to it as a chip you can untick. */
function ItemsView({ groups, items, excluded, onToggle, preview }: Pick<AgentReviewPanelProps, "groups" | "items" | "excluded" | "onToggle"> & { preview: Preview }) {
  const byItem = [...effectsByItem(groups)];
  const ids = byItem.map(([itemId]) => itemId);
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {byItem.map(([itemId, effects]) => {
        const item = items[itemId];
        const saved = !effects.some((effect) => effect.kind === "create");
        return (
          <li key={itemId} className="library-panel flex gap-3 border border-border-control bg-bg-surface p-3">
            <div className="size-24 shrink-0 overflow-hidden rounded-control-lg border border-border-control bg-bg-raised">
              {item && saved ? <Link href={itemPageHref(itemId, "/")} className="block size-full" aria-label={`Look at “${title(item)}”`} onClick={previewClick(preview, ids, itemId)}><Thumbnail item={item} /></Link> : item ? <Thumbnail item={item} /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">{title(item)}</p>
              <div className="mt-2"><EffectChips effects={effects} excluded={excluded} onToggle={onToggle} /></div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ReviewHeader({ children }: { children: ReactNode }) {
  return (
    <header>
      <Link href="/settings#agents" className={buttonClassName({ size: "none", className: "min-h-10 gap-2 px-3 text-sm font-medium justify-start" })}>
        <ArrowLeftIcon className="size-4" />
        <span>Agents</span>
      </Link>
      {children}
    </header>
  );
}

/** The library's quick look, showing one item large with its suggested changes as checkboxes. */
function QuickLook({ look, setLook, groups, items, excluded, onToggle, agentName, returnFocus }: {
  look: { ids: readonly string[]; index: number } | null; setLook(look: { ids: readonly string[]; index: number } | null): void; agentName: string; returnFocus(): HTMLElement | null;
} & Pick<AgentReviewPanelProps, "groups" | "items" | "excluded" | "onToggle">) {
  if (!look) return null;
  const itemId = look.ids[look.index];
  const item = items[itemId] ?? null;
  const effects = effectsByItem(groups).get(itemId) ?? [];
  const move = (step: number) => setLook({ ...look, index: Math.min(look.ids.length - 1, Math.max(0, look.index + step)) });
  return (
    <LibraryQuickPreview
      item={item}
      index={look.index}
      count={look.ids.length}
      onMove={move}
      onClose={() => setLook(null)}
      onOpenItem={(entry) => window.open(itemPageHref(entry.id, "/"), "_blank", "noopener")}
      returnFocus={returnFocus}
      review={{
        busy: false,
        label: `${agentName}'s changes`,
        description: "Review an agent's changes. Left and right arrows browse items. Untick a change to leave it out. Escape closes.",
        emptyState: null,
        progress: <p role="status" aria-live="polite" className="rounded-full border border-border-edge bg-bg-card px-2.5 py-1 text-center text-xs tabular-nums text-text-secondary">{look.index + 1} of {look.ids.length}</p>,
        organization: <div className="shrink-0 space-y-2"><p className="text-xs font-medium text-text-secondary">Suggested for this item</p><EffectChips effects={effects} excluded={excluded} onToggle={onToggle} /></div>,
        footer: (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button disabled={look.index <= 0} onClick={() => move(-1)}>Back</Button>
            <a href={itemPageHref(itemId, "/")} target="_blank" rel="noopener" className={buttonClassName()}>Open in new tab</a>
            <Button disabled={look.index >= look.ids.length - 1} onClick={() => move(1)}>Next</Button>
          </div>
        ),
      }}
    />
  );
}

/** Review an agent's suggestions as pictures of the items they change, grouped by what they do. */
export function AgentReviewPanel(props: AgentReviewPanelProps) {
  const { agentName, createdAt, now, groups, conflicts, excluded, view, backupFolder, busy, onView, onApply, onDecline } = props;
  const [look, setLook] = useState<{ ids: readonly string[]; index: number } | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const preview: Preview = (ids, itemId, from) => {
    opener.current = from;
    setLook({ ids, index: Math.max(0, ids.indexOf(itemId)) });
  };
  const summary = reviewSummary(groups);
  const total = groups.reduce((sum, group) => sum + group.effects.length, 0);
  const chosen = groups.reduce((sum, group) => sum + group.effects.filter((effect) => !excluded.has(effect.key)).length, 0);
  const parts = [
    summary.collections ? count(summary.collections, "collection") : "",
    summary.tags ? count(summary.tags, "tag") : "",
    summary.notes ? count(summary.notes, "note") : "",
    summary.trash ? `${summary.trash} to Trash` : "",
  ].filter(Boolean);
  return (
    <div className="space-y-4">
      <ReviewHeader>
        <h1 className="mt-5 text-2xl font-semibold tracking-heading text-text-primary sm:text-3xl">Review {agentName}&apos;s changes</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Suggested {ago(createdAt, now)} for {count(summary.items, "item")}{parts.length ? `: ${parts.join(", ")}` : ""}. Untick anything you don&apos;t want. Click any item to look at it closely.
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          Keepall keeps a copy of everything this changes, so you can undo it.{backupFolder ? " It also saves a full backup to your backup folder first." : ""}
        </p>
        <SegmentedControl className="mt-4 w-64" label="Review by" value={view} onChange={onView}
          choices={[{ value: "changes", label: "By change" }, { value: "items", label: "By item" }]} />
      </ReviewHeader>
      {conflicts.length ? (
        <div role="note" className="library-panel border border-border-control bg-bg-surface p-4 text-sm leading-6">
          <p className="font-medium text-text-warning">Some suggestions won&apos;t apply as they stand</p>
          <ul className="mt-1 text-text-secondary">{conflicts.map((conflict) => <li key={conflict}>{conflict}</li>)}</ul>
        </div>
      ) : null}
      {view === "changes" ? groups.map((group) => <Group key={group.id} group={group} {...props} preview={preview} />) : <ItemsView {...props} preview={preview} />}
      <QuickLook look={look} setLook={setLook} {...props} returnFocus={() => opener.current} />
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 library-panel border border-border-control bg-bg-surface p-3 sm:p-4">
        <p className="text-sm text-text-secondary">{chosen === total ? `All ${count(total, "change")} included` : `${chosen} of ${count(total, "change")} included`}</p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={onDecline}>Decline all</Button>
          <Button variant="primary" disabled={busy || !chosen} onClick={onApply}>{busy ? "Applying…" : `Apply ${count(chosen, "change")}`}</Button>
        </div>
      </div>
    </div>
  );
}

export type ReviewOutcome = {
  agentName: string;
  applied: number;
  skipped: Array<{ text: string; reason: string }>;
  backup: { status: "saved" | "off" } | { status: "failed"; message: string };
  undone: { kept: string[] } | null;
  declined: boolean;
};

function outcomeHeading(outcome: ReviewOutcome) {
  if (outcome.declined) return "Declined. Nothing changed.";
  if (outcome.undone) return "Undone. Your library is back as it was.";
  return `Applied ${count(outcome.applied, "change")}`;
}

function backupLine(backup: ReviewOutcome["backup"]) {
  if (backup.status === "saved") return "Saved a backup to your folder first. ";
  if (backup.status === "failed") return `The folder backup failed (${backup.message}), but Keepall kept a copy of everything it changed. `;
  return "";
}

/** What happened, with Undo right where the change was made. */
export function AgentReviewResult({ outcome, busy, onUndo, next }: { outcome: ReviewOutcome; busy: boolean; onUndo?: () => void; next?: { id: string; agentName: string } }) {
  const skipped = outcome.skipped.filter((entry) => entry.reason !== "Not chosen");
  const heading = outcomeHeading(outcome);
  const applied = !outcome.declined && !outcome.undone;
  return (
    <div className="space-y-4">
      <ReviewHeader>
        <div role="status"><h1 className="mt-5 text-2xl font-semibold tracking-heading text-text-primary sm:text-3xl">{heading}</h1></div>
        {applied ? <p className="mt-1 text-sm text-text-secondary">{backupLine(outcome.backup)}You can undo this here or later in Settings, Agents.</p> : null}
      </ReviewHeader>
      {outcome.undone?.kept.length ? (
        <ul className="library-panel border border-border-control bg-bg-surface p-4 text-sm leading-6 text-text-warning">{outcome.undone.kept.map((note) => <li key={note}>{note}</li>)}</ul>
      ) : null}
      {skipped.length && !outcome.undone ? (
        <div className="library-panel border border-border-control bg-bg-surface p-4 text-sm leading-6">
          <p className="font-medium text-text-primary">Skipped</p>
          <ul className="mt-1 text-text-secondary">{skipped.map((entry) => <li key={entry.text}>{entry.text}: {entry.reason}</li>)}</ul>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Link href="/" className={buttonClassName({ variant: "primary" })}>Open library</Link>
        {onUndo && applied && outcome.applied ? <Button disabled={busy} onClick={onUndo}>{busy ? "Undoing…" : "Undo"}</Button> : null}
        {next ? <Link href={`/review?proposal=${encodeURIComponent(next.id)}`} className={buttonClassName()}>Review {next.agentName}&apos;s changes</Link> : null}
      </div>
    </div>
  );
}
