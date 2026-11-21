"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { RadioCard } from "@/components/ui/radio-card";
import type { AgentAccess } from "@/domain/agent-changes";
import { agentDisplayName } from "@/domain/agent-review";
import { itemListTitle, type Item } from "@/domain/item";
import { cn } from "@/lib/utils";
import { itemPageHref } from "../item-page-navigation";
import { LibraryItemMedia } from "../library-item-media";
import { NoteIcon } from "../shell-icons";
import { headingClass, paragraphClass, sectionClass } from "./settings-sections";

export type ProposalView = { id: string; agentName: string; createdAt: number; requests: Array<{ id: string; text: string }> };
/** One item in an activity: what happened to it, and the change that did it. */
export type ActivityItem = { item: Item; changes: string[]; entryId: string; undone: boolean; alone: boolean };
/** Changes from one review or one agent call, shown together. */
export type ActivityView = {
  id: string; agentName: string; createdAt: number; summary: string[]; items: ActivityItem[];
  /** Changes in this activity that can still be undone, newest first. */
  undoable: string[];
  undoneAt?: number; undoKept?: string[];
};
export type PairingView = { id: string; agentName: string; createdAt: number; lastUsedAt?: number; access: AgentAccess };

export type AgentsPanelProps = {
  proposals: ProposalView[];
  activities: ActivityView[];
  pairings: PairingView[];
  /** The ID of the proposal, change, or pairing an action is running for. */
  busy: string | null;
  /** The last action's outcome, announced politely. */
  status: { text: string; details?: string[] } | null;
  now: number;
  /** Undoes these changes, newest first; `key` names what's busy. */
  onUndo(changeIds: readonly string[], key: string): void;
  onAccess(pairingId: string, access: AgentAccess): void;
  onDisconnect(pairingId: string): void;
  /** The Connect an agent section, shown above the connected agents. */
  connect?: ReactNode;
};

export const ACCESS_CHOICES: Array<{ value: AgentAccess; label: string; description: string }> = [
  { value: "read", label: "Read only", description: "Search and read your library, including images. No changes." },
  { value: "suggest", label: "Suggest changes", description: "Organize, tag, add notes, and save. Nothing changes until you review it in Keepall." },
  { value: "change", label: "Make changes", description: "Small changes apply right away and can be undone. Changes to more than 10 items wait for review." },
];

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function ago(time: number, now: number) {
  const minutes = Math.round((time - now) / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** A summary that leads to the full review, where every change shows the items it touches. */
function Proposal({ proposal, now }: { proposal: ProposalView } & Pick<AgentsPanelProps, "now">) {
  const headingId = `proposal-${proposal.id}`;
  const shown = proposal.requests.slice(0, 3);
  return (
    <article aria-labelledby={headingId} className="mt-5 rounded-panel border border-border-control p-4 sm:p-5">
      <h3 id={headingId} className="text-base font-semibold text-text-primary">{agentDisplayName(proposal.agentName)} suggests {plural(proposal.requests.length, "change")}</h3>
      <p className="mt-1 text-xs text-text-secondary">Started {ago(proposal.createdAt, now)}.</p>
      <ul className="mt-3 space-y-1 text-sm leading-6 text-text-secondary">
        {shown.map((request) => <li key={request.id} className="truncate">{request.text}</li>)}
        {proposal.requests.length > shown.length ? <li>and {plural(proposal.requests.length - shown.length, "more")}</li> : null}
      </ul>
      <Link href={`/review?proposal=${encodeURIComponent(proposal.id)}`} className={buttonClassName({ variant: "primary", className: "mt-4" })}>Review changes</Link>
    </article>
  );
}

const STRIP_LIMIT = 8;

function ItemThumbnail({ item, className }: { item: Item; className?: string }) {
  return (
    <div data-kind={item.type} className={cn("library-list-thumbnail media-squircle relative shrink-0 overflow-hidden bg-bg-reading", className)}>
      {item.type === "note"
        ? <span className="flex size-full items-center justify-center text-text-secondary"><NoteIcon className="size-5" /></span>
        : <LibraryItemMedia item={item} compact sharedTransition={false} />}
    </div>
  );
}

function itemName(item: Item) {
  if (item.type === "image") return item.caption.trim() || "Image";
  return itemListTitle(item) || "Untitled";
}

/** Every item in an activity, with what happened to it and, where it was its own change, Undo. */
function ActivityItems({ activity, undone, busy, onUndo }: { activity: ActivityView; undone: boolean } & Pick<AgentsPanelProps, "busy" | "onUndo">) {
  return (
    <details className="group mt-3">
      <summary className={buttonClassName({ size: "none", className: "inline-flex min-h-9 cursor-pointer list-none px-3 text-xs font-medium" })}>
        <span className="group-open:hidden">Show {activity.items.length === 1 ? "the item" : `all ${activity.items.length} items`}</span>
        <span className="hidden group-open:inline">Hide items</span>
      </summary>
      <ul className="mt-3 divide-y divide-border-control">
        {activity.items.map((entry) => (
          <li key={entry.item.id} className={cn("flex items-center gap-3 py-2", entry.undone && "opacity-(--opacity-disabled)")}>
            <ItemThumbnail item={entry.item} />
            <div className="min-w-0 flex-1">
              <Link href={itemPageHref(entry.item.id, "/")} className="block truncate text-sm font-medium text-text-primary underline-offset-2 hover:underline">{itemName(entry.item)}</Link>
              <p className="truncate text-xs text-text-secondary">{entry.undone ? "Undone" : entry.changes.join(" · ")}</p>
            </div>
            {entry.alone && !entry.undone && !undone
              ? <Button disabled={busy === entry.entryId} onClick={() => onUndo([entry.entryId], entry.entryId)}>{busy === entry.entryId ? "Undoing…" : "Undo"}</Button>
              : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** One review's or call's changes: a plain summary, the items as thumbnails, and every item on request. */
function Activity({ activity, busy, now, onUndo }: { activity: ActivityView } & Pick<AgentsPanelProps, "busy" | "now" | "onUndo">) {
  const undone = !activity.undoable.length;
  const shown = activity.items.slice(0, STRIP_LIMIT);
  const headingId = `activity-${activity.id}`;
  return (
    <article aria-labelledby={headingId} className={cn("mt-4 rounded-panel border border-border-control p-4 sm:p-5", undone && "opacity-(--opacity-disabled)")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="text-sm font-medium text-text-primary">
            {agentDisplayName(activity.agentName)} <span className="font-normal text-text-secondary">· {ago(activity.createdAt, now)}</span>
          </h3>
          <ul className="mt-1 space-y-0.5 text-sm leading-6 text-text-primary">{activity.summary.map((line) => <li key={line}>{line}</li>)}</ul>
        </div>
        {undone
          ? <p className="text-xs text-text-secondary">{activity.undoneAt ? `Undone ${ago(activity.undoneAt, now)}` : "Undone"}</p>
          : <Button disabled={busy === activity.id} onClick={() => onUndo(activity.undoable, activity.id)}>{busy === activity.id ? "Undoing…" : activity.undoable.length > 1 ? "Undo all" : "Undo"}</Button>}
      </div>
      {!undone && shown.length ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Items changed">
          {shown.map(({ item }) => (
            <li key={item.id}>
              <Link href={itemPageHref(item.id, "/")} aria-label={itemName(item)} className="block rounded-control-lg focus-visible:outline focus-visible:outline-1 focus-visible:outline-border-focus"><ItemThumbnail item={item} /></Link>
            </li>
          ))}
          {activity.items.length > shown.length ? <li className="library-list-thumbnail media-squircle flex items-center justify-center bg-bg-raised text-xs font-medium text-text-secondary">+{activity.items.length - shown.length}</li> : null}
        </ul>
      ) : null}
      {activity.undoKept?.length ? <ul className="mt-2 space-y-1 text-xs leading-5 text-text-warning">{activity.undoKept.map((note) => <li key={note}>{note}</li>)}</ul> : null}
      {activity.items.length ? <ActivityItems activity={activity} undone={undone} busy={busy} onUndo={onUndo} /> : null}
    </article>
  );
}

function Pairing({ pairing, busy, now, onAccess, onDisconnect }: { pairing: PairingView } & Pick<AgentsPanelProps, "busy" | "now" | "onAccess" | "onDisconnect">) {
  const headingId = `pairing-${pairing.id}`;
  return (
    <article aria-labelledby={headingId} className="mt-5 rounded-panel border border-border-control p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={headingId} className="text-base font-semibold text-text-primary">{agentDisplayName(pairing.agentName)}</h3>
          <p className="mt-1 text-xs text-text-secondary">
            {pairing.lastUsedAt ? `Connected ${ago(pairing.createdAt, now)}, last used ${ago(pairing.lastUsedAt, now)}` : `Set up ${ago(pairing.createdAt, now)}, waiting for its first request`}
          </p>
        </div>
        <Button variant="danger-ghost" disabled={busy === pairing.id} onClick={() => onDisconnect(pairing.id)}>Disconnect</Button>
      </div>
      <fieldset className="mt-4 grid gap-2" disabled={busy === pairing.id}>
        <legend className="mb-2 text-sm font-medium text-text-primary">What {agentDisplayName(pairing.agentName)} can do</legend>
        {ACCESS_CHOICES.map((choice) => (
          <RadioCard key={choice.value} name={`access-${pairing.id}`} value={choice.value} checked={pairing.access === choice.value} onChange={() => onAccess(pairing.id, choice.value)}>
            <span><span className="block font-medium text-text-primary">{choice.label}</span><span className="mt-0.5 block text-text-secondary">{choice.description}</span></span>
          </RadioCard>
        ))}
      </fieldset>
    </article>
  );
}

/** Settings → Agents: suggestions waiting for review, applied changes with undo, and connected agents. */
export function AgentsPanel(props: AgentsPanelProps) {
  const { proposals, activities, pairings, status } = props;
  return (
    <>
      {status ? (
        <div role="status" className="library-panel border border-border-control bg-bg-surface p-4 text-sm text-text-primary">
          <p className="font-medium">{status.text}</p>
          {status.details?.length ? <ul className="mt-2 space-y-1 text-text-secondary">{status.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul> : null}
        </div>
      ) : null}
      <section className={sectionClass} aria-labelledby="agents-review-heading">
        <h2 id="agents-review-heading" className={headingClass}>Waiting for your review</h2>
        <p className={paragraphClass}>{proposals.length ? "Changes agents suggested for your library. Nothing changes until you review and apply them." : "Nothing to review. When an agent suggests changes, they appear here."}</p>
        {proposals.map((proposal) => <Proposal key={proposal.id} proposal={proposal} {...props} />)}
      </section>
      <section className={sectionClass} aria-labelledby="agents-changes-heading">
        <h2 id="agents-changes-heading" className={headingClass}>Recent changes</h2>
        <p className={paragraphClass}>
          {activities.length ? "What agents changed, newest first. Undo puts back the copy Keepall kept, and leaves anything you've edited since." : "Changes agents make will appear here, each with Undo."}
        </p>
        {activities.map((activity) => <Activity key={activity.id} activity={activity} {...props} />)}
      </section>
      {props.connect}
      <section className={sectionClass} aria-labelledby="agents-connected-heading">
        <h2 id="agents-connected-heading" className={headingClass}>Connected agents</h2>
        <p className={paragraphClass}>
          {pairings.length
            ? "Agents reach this library through Keepall's relay, end-to-end encrypted. They answer while Chrome is open with Keepall Capture or a Keepall tab."
            : "No agents are connected. Add the Keepall MCP server to Claude Code, Codex, or OpenCode, then ask it to search Keepall. It gives you a link to connect."}
        </p>
        {pairings.map((pairing) => <Pairing key={pairing.id} pairing={pairing} {...props} />)}
      </section>
    </>
  );
}
