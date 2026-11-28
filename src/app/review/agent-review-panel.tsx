"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import type { StepEffect } from "@/domain/agent-changes";
import { reviewSummary, type ReviewGroup } from "@/domain/agent-review";
import { itemListTitle, type Item } from "@/domain/item";
import { cn } from "@/lib/utils";
import { ItemTypeBadge } from "../item-type-icon";
import { LibraryItemMedia } from "../library-item-media";
import { LibraryTextPreview } from "../library-text-preview";
import { PendingFileThumbnail, pendingFileIds } from "../pending-file-preview";
import { LibrarySelectionControl } from "../library-selection-control";
import { ArrowLeftIcon, EyeIcon, NoteIcon } from "../shell-icons";
import { useFormatLocale, useTranslations, type Translations } from "@/i18n/use-translations";
import { useAgo } from "../use-ago";

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
  /** Opens the one-at-a-time review at this item, or at the first one. */
  onReview(itemId: string | null, from: HTMLElement | null): void;
  onApply(): void;
  onDecline(): void;
};

/** The library card's corner selection control, exactly as library-item.tsx places it. */
const TILE_CONTROL = "library-card-media-chrome library-card-corner-control library-card-corner-start absolute z-20 flex items-center justify-center";
// Positioned, so the control's enlarged hit area stays around it instead of covering the page.
const ROW_CONTROL = "library-card-media-chrome library-card-corner-control relative flex shrink-0 items-center justify-center";

type T = Translations<"AgentReview">;

/** Images saved from the web are titled by their site, which says nothing in a grid of them; use the caption or file name. */
function title(t: T, item: Item | undefined) {
  if (!item) return t("untitled");
  if (item.type === "image") return item.caption.trim() || item.sourceFileName?.replace(/\.[^.]+$/, "") || t("image");
  return itemListTitle(item) || t("untitled");
}

type Target = (itemId: string, from: HTMLElement) => void;

/**
 * The item's own picture, or for a note its text the way library cards show it. On a tile the selection control
 * sits in the top corner, so the text starts below it.
 */
function Thumbnail({ item, compact = false }: { item: Item; compact?: boolean }) {
  if (item.type === "note") {
    if (compact) return <span className="flex size-full items-center justify-center"><NoteIcon className="size-5 text-text-secondary" /></span>;
    return (
      <span className="library-reading-inset media-squircle-inset flex size-full flex-col text-left">
        <span aria-hidden="true" className="block h-8 shrink-0" />
        <LibraryTextPreview text={item.content} markdown={item.format === "markdown"} />
        <ItemTypeBadge item={item} />
      </span>
    );
  }
  // Files the agent sent aren't saved yet; show them from where they wait.
  if (pendingFileIds(item)) return compact ? <span className="flex size-full items-center justify-center"><NoteIcon className="size-5 text-text-secondary" /></span> : <PendingFileThumbnail item={item} />;
  return <LibraryItemMedia item={item} variant="card" sharedTransition={false} />;
}

/**
 * A library card (same shell, squircle media, and corner control). Clicking it or pressing Space opens the review
 * at this item; the corner control includes it or leaves it out of Apply all.
 */
function Tile({ item, itemId, keys, excluded, onToggle, saved, review, focus }: {
  item: Item | undefined; itemId: string; keys: readonly string[]; excluded: ReadonlySet<string>; onToggle: AgentReviewPanelProps["onToggle"]; saved: boolean;
  review: Target; focus: Target;
}) {
  const included = keys.some((key) => !excluded.has(key));
  const t = useTranslations("AgentReview");
  const name = title(t, item);
  const media = (
    <div className="library-card-media relative">
      <div className="aspect-4/5 w-full">{item ? <Thumbnail item={item} /> : null}</div>
    </div>
  );
  return (
    <li className="min-w-0">
      <div className={cn("library-card group relative flex flex-col rounded-card p-2", !included && "opacity-(--opacity-disabled)")}>
        <LibrarySelectionControl label={t("include", { name })} className={TILE_CONTROL} visible selected={included} disabled={false} onToggle={() => onToggle(keys, !included)} />
        {saved ? (
          <button type="button" className="library-card-open control-shape-none block text-left" aria-label={t("review", { name })} aria-keyshortcuts="Space"
            onClick={(event) => review(itemId, event.currentTarget)} onFocus={(event) => focus(itemId, event.currentTarget)}>{media}</button>
        ) : media}
        <p className="mt-2 truncate px-2 text-xs text-text-card-meta">{name}</p>
      </div>
    </li>
  );
}

function NoteRow({ effect, item, excluded, onToggle }: { effect: Extract<StepEffect, { kind: "note" }>; item: Item | undefined } & Pick<AgentReviewPanelProps, "excluded" | "onToggle">) {
  const before = effect.before.trim();
  const appended = !before || effect.after.startsWith(before);
  const included = !excluded.has(effect.key);
  const t = useTranslations("AgentReview");
  return (
    <li className={cn("flex items-start gap-3 border-t border-border-control pt-4 first:border-t-0 first:pt-0", !included && "opacity-(--opacity-disabled)")}>
      <LibrarySelectionControl label={t("includeNote", { title: title(t, item) })} className={ROW_CONTROL} visible selected={included} disabled={false} onToggle={() => onToggle([effect.key], !included)} />
      <div className="size-16 shrink-0 overflow-hidden rounded-control-md border border-border-control bg-bg-raised">{item ? <Thumbnail item={item} compact /> : null}</div>
      <div className="min-w-0 flex-1 text-sm leading-6">
        <p className="font-medium text-text-primary">{title(t, item)}</p>
        {before ? <p className={cn("mt-1 line-clamp-2", appended ? "text-text-secondary" : "text-text-danger line-through")}>{before}</p> : null}
        <p className="mt-1 whitespace-pre-wrap rounded-control-xs bg-bg-selected px-2 py-1 text-text-primary">{appended ? effect.after.slice(before.length).trim() : effect.after}</p>
      </div>
    </li>
  );
}

function Group({ group, items, excluded, onToggle, review, focus }: { group: ReviewGroup; review: Target; focus: Target } & Pick<AgentReviewPanelProps, "items" | "excluded" | "onToggle">) {
  const headingId = `group-${group.id}`;
  const keys = group.effects.map((effect) => effect.key);
  const chosen = keys.filter((key) => !excluded.has(key)).length;
  const t = useTranslations("AgentReview");
  const reviewText = useTranslations("Review");
  const keysFor = (itemId: string) => group.effects.filter((effect) => "itemId" in effect && effect.itemId === itemId).map((effect) => effect.key);
  return (
    <section aria-labelledby={headingId} className="library-panel border border-border-control bg-bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className={cn("text-base font-semibold", group.caution ? "text-text-danger" : "text-text-primary")}>{group.title}</h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            {(() => {
              const summary = group.itemIds.length ? t("items", { count: group.itemIds.length }) : t("changes", { count: group.effects.length });
              return chosen < keys.length ? t("withIncluded", { summary, count: chosen }) : summary;
            })()}
          </p>
          {group.reasons.map((reason) => <p key={reason} className="mt-2 text-sm leading-6 text-text-secondary">{reviewText("quoted", { text: reason })}</p>)}
        </div>
        <Button onClick={() => onToggle(keys, chosen < keys.length)}>{chosen < keys.length ? t("includeAll") : t("leaveOutAll")}</Button>
      </div>
      {group.kind === "note" ? (
        <ul className="mt-4 space-y-4">
          {group.effects.map((effect) => effect.kind === "note" ? <NoteRow key={effect.key} effect={effect} item={items[effect.itemId]} excluded={excluded} onToggle={onToggle} /> : null)}
        </ul>
      ) : group.itemIds.length ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {group.itemIds.map((itemId) => (
            <Tile key={itemId} itemId={itemId} item={items[itemId]} keys={keysFor(itemId)} excluded={excluded} onToggle={onToggle} saved review={review} focus={focus} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function ReviewHeader({ children }: { children: ReactNode }) {
  const t = useTranslations("AgentReview");
  return (
    <header>
      <Link href="/settings#agents-connect-heading" className={buttonClassName({ size: "none", className: "min-h-10 gap-2 px-3 text-sm font-medium justify-start" })}>
        <ArrowLeftIcon className="size-4" />
        <span>{t("agents")}</span>
      </Link>
      {children}
    </header>
  );
}

function summaryLine(t: T, locale: string | undefined, groups: readonly ReviewGroup[]) {
  const summary = reviewSummary(groups);
  const parts = [
    summary.collections ? t("collections", { count: summary.collections }) : "",
    summary.tags ? t("tags", { count: summary.tags }) : "",
    summary.notes ? t("notes", { count: summary.notes }) : "",
    summary.trash ? t("toTrash", { count: summary.trash }) : "",
  ].filter(Boolean);
  const items = t("items", { count: summary.items });
  return parts.length ? t("summaryWithParts", { items, parts: new Intl.ListFormat(locale, { type: "unit", style: "short" }).format(parts) }) : items;
}

/** All of an agent's suggestions at once, as pictures of the items they change, grouped by what they do. */
export function AgentReviewPanel(props: AgentReviewPanelProps) {
  const { agentName, createdAt, now, groups, conflicts, excluded, backupFolder, busy, onReview, onApply, onDecline } = props;
  const focused = useRef<{ itemId: string; from: HTMLElement } | null>(null);
  const t = useTranslations("AgentReview");
  const locale = useFormatLocale();
  const ago = useAgo();
  const focus: Target = (itemId, from) => {
    focused.current = { itemId, from };
  };
  // Cards are buttons, so Space on a focused card reviews it, like Space previews in the library.
  const review: Target = (itemId, from) => onReview(itemId, from);
  const total = groups.reduce((sum, group) => sum + group.effects.length, 0);
  const chosen = groups.reduce((sum, group) => sum + group.effects.filter((effect) => !excluded.has(effect.key)).length, 0);
  return (
    <div className="space-y-4">
      <ReviewHeader>
        <h1 className="mt-5 text-2xl font-semibold tracking-heading text-text-primary sm:text-3xl">{t("title", { agent: agentName })}</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {t("intro", { when: ago(createdAt, now), summary: summaryLine(t, locale, groups) })}
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          {backupFolder ? t("copyNoteBackup") : t("copyNote")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Tooltip content={t("reviewTooltip")} describe={false}>
            <button type="button" aria-keyshortcuts="Space" aria-haspopup="dialog" className={buttonClassName({ size: "none", className: "min-h-10 gap-2 ps-3 pe-4 text-sm font-medium" })}
              onClick={(event) => onReview(focused.current?.itemId ?? null, event.currentTarget)}>
              <EyeIcon className="size-4" /><span>{t("reviewOneAtATime")}</span>
            </button>
          </Tooltip>
        </div>
      </ReviewHeader>
      {conflicts.length ? (
        <div role="note" className="library-panel border border-border-control bg-bg-surface p-4 text-sm leading-6">
          <p className="font-medium text-text-warning">{t("conflictsTitle")}</p>
          <ul className="mt-1 text-text-secondary">{conflicts.map((conflict) => <li key={conflict}>{conflict}</li>)}</ul>
        </div>
      ) : null}
      {groups.map((group) => <Group key={group.id} group={group} {...props} review={review} focus={focus} />)}
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 library-panel border border-border-control bg-bg-surface p-3 sm:p-4">
        <p className="text-sm text-text-secondary">{chosen === total ? t("allIncluded", { count: total }) : t("someIncluded", { chosen, count: total })}</p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={onDecline}>{t("declineAll")}</Button>
          <Button variant="primary" disabled={busy || !chosen} onClick={onApply}>{busy ? t("applying") : t("apply", { count: chosen })}</Button>
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

function outcomeHeading(t: T, outcome: ReviewOutcome) {
  if (outcome.declined) return t("declined");
  if (outcome.undone) return t("undone");
  return t("applied", { count: outcome.applied });
}

function appliedLine(t: T, backup: ReviewOutcome["backup"]) {
  if (backup.status === "saved") return t("backupSaved");
  if (backup.status === "failed") return t("backupFailed", { message: backup.message });
  return t("undoLater");
}

/** What happened, with Undo right where the change was made. */
export function AgentReviewResult({ outcome, busy, onUndo, next }: { outcome: ReviewOutcome; busy: boolean; onUndo?: () => void; next?: { id: string; agentName: string } }) {
  const skipped = outcome.skipped.filter((entry) => entry.reason !== "Not chosen");
  const applied = !outcome.declined && !outcome.undone;
  const t = useTranslations("AgentReview");
  const common = useTranslations("Common");
  return (
    <div className="space-y-4">
      <ReviewHeader>
        <div role="status"><h1 className="mt-5 text-2xl font-semibold tracking-heading text-text-primary sm:text-3xl">{outcomeHeading(t, outcome)}</h1></div>
        {applied ? <p className="mt-1 text-sm text-text-secondary">{appliedLine(t, outcome.backup)}</p> : null}
      </ReviewHeader>
      {outcome.undone?.kept.length ? (
        <ul className="library-panel border border-border-control bg-bg-surface p-4 text-sm leading-6 text-text-warning">{outcome.undone.kept.map((note) => <li key={note}>{note}</li>)}</ul>
      ) : null}
      {skipped.length && !outcome.undone ? (
        <div className="library-panel border border-border-control bg-bg-surface p-4 text-sm leading-6">
          <p className="font-medium text-text-primary">{t("skipped")}</p>
          <ul className="mt-1 text-text-secondary">{skipped.map((entry) => <li key={entry.text}>{common("labelValue", { label: entry.text, value: entry.reason })}</li>)}</ul>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Link href="/" className={buttonClassName({ variant: "primary" })}>{t("openLibrary")}</Link>
        {onUndo && applied && outcome.applied ? <Button disabled={busy} onClick={onUndo}>{busy ? t("undoing") : t("undo")}</Button> : null}
        {next ? <Link href={`/review?proposal=${encodeURIComponent(next.id)}`} className={buttonClassName()}>{t("reviewNext", { agent: next.agentName })}</Link> : null}
      </div>
    </div>
  );
}
