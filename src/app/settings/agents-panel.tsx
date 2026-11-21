"use client";

import Link from "next/link";
import { Button, buttonClassName } from "@/components/ui/button";
import { RadioCard } from "@/components/ui/radio-card";
import type { AgentAccess } from "@/domain/agent-changes";
import { agentDisplayName } from "@/domain/agent-review";
import { headingClass, paragraphClass, sectionClass } from "./settings-sections";

export type ProposalView = { id: string; agentName: string; createdAt: number; requests: Array<{ id: string; text: string }> };
export type ChangeView = { id: string; agentName: string; createdAt: number; steps: string[]; undoneAt?: number; undoKept?: string[] };
export type PairingView = { id: string; agentName: string; createdAt: number; lastUsedAt?: number; access: AgentAccess };

export type AgentsPanelProps = {
  proposals: ProposalView[];
  changes: ChangeView[];
  pairings: PairingView[];
  /** The ID of the proposal, change, or pairing an action is running for. */
  busy: string | null;
  /** The last action's outcome, announced politely. */
  status: { text: string; details?: string[] } | null;
  now: number;
  onUndo(changeId: string): void;
  onAccess(pairingId: string, access: AgentAccess): void;
  onDisconnect(pairingId: string): void;
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

function Change({ change, busy, now, onUndo }: { change: ChangeView } & Pick<AgentsPanelProps, "busy" | "now" | "onUndo">) {
  const shown = change.steps.slice(0, 3);
  return (
    <li className="border-t border-border-control py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary">{agentDisplayName(change.agentName)} <span className="font-normal text-text-secondary">· {ago(change.createdAt, now)}</span></p>
          <ul className="mt-1 space-y-1 text-sm leading-6 text-text-secondary">
            {shown.map((step, index) => <li key={index}>{step}</li>)}
            {change.steps.length > shown.length ? <li>and {plural(change.steps.length - shown.length, "more change")}</li> : null}
          </ul>
        </div>
        {change.undoneAt
          ? <p className="text-xs text-text-secondary">Undone {ago(change.undoneAt, now)}</p>
          : <Button disabled={busy === change.id} onClick={() => onUndo(change.id)}>{busy === change.id ? "Undoing…" : "Undo"}</Button>}
      </div>
      {change.undoKept?.length ? (
        <ul className="mt-2 space-y-1 text-xs leading-5 text-text-warning">{change.undoKept.map((note, index) => <li key={index}>{note}</li>)}</ul>
      ) : null}
    </li>
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
            Connected {ago(pairing.createdAt, now)}{pairing.lastUsedAt ? `, last used ${ago(pairing.lastUsedAt, now)}` : ""}
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
  const { proposals, changes, pairings, status } = props;
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
          {changes.length ? "Every change an agent made, newest first. Undo puts back the copy Keepall kept, and leaves anything you've edited since." : "Changes agents make will appear here, each with Undo."}
        </p>
        {changes.length ? <ul className="mt-5">{changes.map((change) => <Change key={change.id} change={change} {...props} />)}</ul> : null}
      </section>
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
