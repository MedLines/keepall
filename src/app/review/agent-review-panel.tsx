"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import type { StepEffect } from "@/domain/agent-changes";
import { reviewSummary, type ReviewGroup } from "@/domain/agent-review";
import { itemListTitle, type Item } from "@/domain/item";
import { cn } from "@/lib/utils";
import { itemPageHref } from "../item-page-navigation";
import { LibraryItemMedia } from "../library-item-media";
import { LibraryQuickPreview } from "../library-quick-preview";
import { LibrarySelectionControl } from "../library-selection-control";
import { ArrowLeftIcon, EyeIcon, NoteIcon } from "../shell-icons";
import { AGENT_REVIEW_PARAM } from "../use-agent-review-offer";

export type AgentReviewPanelProps = {
  agentName: string;
  createdAt: number;
  now: number;
  groups: ReviewGroup[];
  items: Record<string, Item>;
  /** Suggestions that can't apply as they stand, in words. */
  conflicts: string[];
  /** Effect keys the reviewer left out. */
  excluded: ReadonlySet<string>;
  backupFolder: boolean;
  busy: boolean;
  onToggle(keys: readonly string[], include: boolean): void;
  onApply(): void;
  onDecline(): void;
};

/** The library's corner selection control, placed on a review tile or note row. */
const TILE_CONTROL = "library-card-media-chrome library-card-corner-control library-card-corner-start absolute z-20 flex items-center justify-center";
const ROW_CONTROL = "library-card-media-chrome library-card-corner-control flex shrink-0 items-center justify-center";

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

type Target = (ids: readonly string[], itemId: string, from: HTMLElement) => void;

/** The item's own picture, or for a note its first lines. */
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

/**
 * Like a library card: a plain click or Space previews it, modified clicks keep the link's own behavior (a new tab),
 * and the corner control includes it or leaves it out.
 */
function Tile({ item, itemId, keys, excluded, onToggle, saved, preview, focus, siblings }: {
  item: Item | undefined; itemId: string; keys: readonly string[]; excluded: ReadonlySet<string>; onToggle: AgentReviewPanelProps["onToggle"]; saved: boolean;
  preview: Target; focus: Target; siblings: readonly string[];
}) {
  const included = keys.some((key) => !excluded.has(key));
  const name = title(item);
  const media = item ? <Thumbnail item={item} /> : null;
  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    preview(siblings, itemId, event.currentTarget);
  };
  const space = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key !== " ") return;
    event.preventDefault();
    preview(siblings, itemId, event.currentTarget);
  };
  return (
    <li className="min-w-0">
      <div className={cn("relative aspect-square overflow-hidden rounded-control-lg border border-border-control bg-bg-raised", !included && "opacity-(--opacity-disabled)")}>
        {saved && item ? (
          <Link href={itemPageHref(itemId, "/")} className="block size-full" aria-label={`Preview “${name}”`} aria-keyshortcuts="Space"
            onClick={click} onKeyDown={space} onFocus={(event) => focus(siblings, itemId, event.currentTarget)}>{media}</Link>
        ) : media}
        <LibrarySelectionControl label={`Include “${name}”`} className={TILE_CONTROL} visible selected={included} disabled={false} onToggle={() => onToggle(keys, !included)} />
      </div>
      <p className="mt-1.5 truncate text-xs text-text-secondary">{name}</p>
    </li>
  );
}

function NoteRow({ effect, item, excluded, onToggle }: { effect: Extract<StepEffect, { kind: "note" }>; item: Item | undefined } & Pick<AgentReviewPanelProps, "excluded" | "onToggle">) {
  const before = effect.before.trim();
  const appended = !before || effect.after.startsWith(before);
  const included = !excluded.has(effect.key);
  return (
    <li className={cn("flex items-start gap-3 border-t border-border-control pt-4 first:border-t-0 first:pt-0", !included && "opacity-(--opacity-disabled)")}>
      <LibrarySelectionControl label={`Include the note on “${title(item)}”`} className={ROW_CONTROL} visible selected={included} disabled={false} onToggle={() => onToggle([effect.key], !included)} />
      <div className="size-16 shrink-0 overflow-hidden rounded-control-md border border-border-control bg-bg-raised">{item ? <Thumbnail item={item} /> : null}</div>
      <div className="min-w-0 flex-1 text-sm leading-6">
        <p className="font-medium text-text-primary">{title(item)}</p>
        {before ? <p className={cn("mt-1 line-clamp-2", appended ? "text-text-secondary" : "text-text-danger line-through")}>{before}</p> : null}
        <p className="mt-1 whitespace-pre-wrap rounded-control-xs bg-bg-selected px-2 py-1 text-text-primary">{appended ? effect.after.slice(before.length).trim() : effect.after}</p>
      </div>
    </li>
  );
}

function Group({ group, items, excluded, onToggle, preview, focus }: { group: ReviewGroup; preview: Target; focus: Target } & Pick<AgentReviewPanelProps, "items" | "excluded" | "onToggle">) {
  const headingId = `group-${group.id}`;
  const keys = group.effects.map((effect) => effect.key);
  const chosen = keys.filter((key) => !excluded.has(key)).length;
  const keysFor = (itemId: string) => group.effects.filter((effect) => "itemId" in effect && effect.itemId === itemId).map((effect) => effect.key);
  return (
    <section aria-labelledby={headingId} className="library-panel border border-border-control bg-bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className={cn("text-base font-semibold", group.caution ? "text-text-danger" : "text-text-primary")}>{group.title}</h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            {group.itemIds.length ? count(group.itemIds.length, "item") : count(group.effects.length, "change")}
            {chosen < keys.length ? ` · ${chosen} included` : ""}
          </p>
          {group.reasons.map((reason) => <p key={reason} className="mt-2 text-sm leading-6 text-text-secondary">“{reason}”</p>)}
        </div>
        <Button onClick={() => onToggle(keys, chosen < keys.length)}>{chosen < keys.length ? "Include all" : "Leave out all"}</Button>
      </div>
      {group.kind === "note" ? (
        <ul className="mt-4 space-y-4">
          {group.effects.map((effect) => effect.kind === "note" ? <NoteRow key={effect.key} effect={effect} item={items[effect.itemId]} excluded={excluded} onToggle={onToggle} /> : null)}
        </ul>
      ) : group.itemIds.length ? (
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {group.itemIds.map((itemId) => (
            <Tile key={itemId} itemId={itemId} item={items[itemId]} keys={keysFor(itemId)} excluded={excluded} onToggle={onToggle} saved={group.kind !== "create"} preview={preview} focus={focus} siblings={group.itemIds} />
          ))}
        </ul>
      ) : null}
    </section>
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

function summaryLine(groups: readonly ReviewGroup[]) {
  const summary = reviewSummary(groups);
  const parts = [
    summary.collections ? count(summary.collections, "collection") : "",
    summary.tags ? count(summary.tags, "tag") : "",
    summary.notes ? count(summary.notes, "note") : "",
    summary.trash ? `${summary.trash} to Trash` : "",
  ].filter(Boolean);
  return `${count(summary.items, "item")}${parts.length ? `: ${parts.join(", ")}` : ""}`;
}

/** All of an agent's suggestions at once, as pictures of the items they change, grouped by what they do. */
export function AgentReviewPanel(props: AgentReviewPanelProps) {
  const { agentName, createdAt, now, groups, items, conflicts, excluded, backupFolder, busy, onApply, onDecline } = props;
  const [look, setLook] = useState<{ ids: readonly string[]; index: number } | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const focused = useRef<{ ids: readonly string[]; itemId: string } | null>(null);
  const preview: Target = (ids, itemId, from) => {
    opener.current = from;
    setLook({ ids, index: Math.max(0, ids.indexOf(itemId)) });
  };
  const focus: Target = (ids, itemId, from) => {
    focused.current = { ids, itemId };
    opener.current = from;
  };
  const firstGroup = groups.find((group) => group.itemIds.length && group.kind !== "create");
  const previewFocused = () => {
    const target = focused.current ?? (firstGroup ? { ids: firstGroup.itemIds, itemId: firstGroup.itemIds[0] } : null);
    if (target) setLook({ ids: target.ids, index: Math.max(0, target.ids.indexOf(target.itemId)) });
  };
  const total = groups.reduce((sum, group) => sum + group.effects.length, 0);
  const chosen = groups.reduce((sum, group) => sum + group.effects.filter((effect) => !excluded.has(effect.key)).length, 0);
  const lookId = look ? look.ids[look.index] : undefined;
  return (
    <div className="space-y-4">
      <ReviewHeader>
        <h1 className="mt-5 text-2xl font-semibold tracking-heading text-text-primary sm:text-3xl">All of {agentName}&apos;s changes</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Suggested {ago(createdAt, now)} for {summaryLine(groups)}. Leave out anything you don&apos;t want, then apply the rest at once.
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          Keepall keeps a copy of everything this changes, so you can undo it.{backupFolder ? " It also saves a full backup to your backup folder first." : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/?${AGENT_REVIEW_PARAM}=1`} className={buttonClassName()}>Review one at a time</Link>
          <Tooltip content="Preview the focused item (Space)" describe={false}>
            <button type="button" aria-label="Preview" aria-keyshortcuts="Space" aria-haspopup="dialog" disabled={!firstGroup}
              className={buttonClassName({ size: "none", className: "min-h-10 gap-2 ps-3 pe-4 text-sm font-medium" })} onClick={previewFocused}>
              <EyeIcon className="size-4" /><span>Preview</span>
            </button>
          </Tooltip>
        </div>
      </ReviewHeader>
      {conflicts.length ? (
        <div role="note" className="library-panel border border-border-control bg-bg-surface p-4 text-sm leading-6">
          <p className="font-medium text-text-warning">Some suggestions won&apos;t apply as they stand</p>
          <ul className="mt-1 text-text-secondary">{conflicts.map((conflict) => <li key={conflict}>{conflict}</li>)}</ul>
        </div>
      ) : null}
      {groups.map((group) => <Group key={group.id} group={group} {...props} preview={preview} focus={focus} />)}
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 library-panel border border-border-control bg-bg-surface p-3 sm:p-4">
        <p className="text-sm text-text-secondary">{chosen === total ? `All ${count(total, "change")} included` : `${chosen} of ${count(total, "change")} included`}</p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={onDecline}>Decline all</Button>
          <Button variant="primary" disabled={busy || !chosen} onClick={onApply}>{busy ? "Applying…" : `Apply ${count(chosen, "change")}`}</Button>
        </div>
      </div>
      {look ? (
        <LibraryQuickPreview
          item={lookId ? items[lookId] ?? null : null}
          index={look.index}
          count={look.ids.length}
          onMove={(step) => setLook({ ...look, index: Math.min(look.ids.length - 1, Math.max(0, look.index + step)) })}
          onClose={() => setLook(null)}
          onOpenItem={(entry) => window.open(itemPageHref(entry.id, "/"), "_blank", "noopener")}
          returnFocus={() => opener.current}
        />
      ) : null}
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
  const applied = !outcome.declined && !outcome.undone;
  return (
    <div className="space-y-4">
      <ReviewHeader>
        <div role="status"><h1 className="mt-5 text-2xl font-semibold tracking-heading text-text-primary sm:text-3xl">{outcomeHeading(outcome)}</h1></div>
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
