"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { buttonClassName } from "@/components/ui/button";
import { agentDisplayName, groupEffects, type ReviewGroup } from "@/domain/agent-review";
import type { Item } from "@/domain/item";
import {
  AGENT_CHANGES_CHANNEL, applyAgentProposal, listOpenProposals, previewAgentProposal, rejectAgentProposal, undoAgentChange,
} from "@/persistence/agent-changes";
import { getBackupFolderSettings } from "@/persistence/backup-settings";
import { AgentReviewPanel, AgentReviewResult, ReviewHeader, type ReviewOutcome } from "./agent-review-panel";

type Loaded =
  | { status: "loading" }
  | { status: "empty" }
  | {
    status: "ready"; proposalId: string; agentName: string; createdAt: number; groups: ReviewGroup[]; items: Record<string, Item>;
    conflicts: string[]; others: Array<{ id: string; agentName: string }>; backupFolder: boolean;
  };

async function load(): Promise<Loaded> {
  const wanted = new URLSearchParams(window.location.search).get("proposal");
  const open = await listOpenProposals();
  const proposal = open.find((entry) => entry.id === wanted) ?? open[0];
  if (!proposal) return { status: "empty" };
  const [preview, backup] = await Promise.all([previewAgentProposal(proposal.id), getBackupFolderSettings().catch(() => null)]);
  if (!preview) return { status: "empty" };
  return {
    status: "ready",
    proposalId: proposal.id,
    agentName: agentDisplayName(proposal.agentName),
    createdAt: proposal.createdAt,
    groups: groupEffects(preview.steps),
    items: preview.items,
    conflicts: [...new Set(preview.steps.flatMap((step) => step.notes))],
    others: open.filter((entry) => entry.id !== proposal.id).map((entry) => ({ id: entry.id, agentName: agentDisplayName(entry.agentName) })),
    backupFolder: !!backup?.enabled,
  };
}

export function AgentReview() {
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ outcome: ReviewOutcome; changeId?: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const finished = useRef(false);

  const show = useCallback((next: Loaded) => {
    setLoaded(next);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    load().then(show, () => show({ status: "empty" }));
    // The agent may keep suggesting while the review is open; show new suggestions as they arrive.
    const channel = new BroadcastChannel(AGENT_CHANGES_CHANNEL);
    channel.onmessage = () => {
      if (!finished.current) load().then(show, () => {});
    };
    return () => channel.close();
  }, [show]);

  if (done) {
    const next = loaded.status === "ready" ? loaded.others[0] : undefined;
    return (
      <AgentReviewResult
        outcome={done.outcome}
        busy={busy}
        next={next}
        onUndo={done.changeId ? async () => {
          setBusy(true);
          try {
            const result = await undoAgentChange(done.changeId!);
            setDone({ ...done, outcome: { ...done.outcome, undone: { kept: result.kept } } });
          } finally {
            setBusy(false);
          }
        } : undefined}
      />
    );
  }

  if (loaded.status === "loading") return <p className="py-10 text-sm text-text-secondary">Loading suggestions…</p>;
  if (loaded.status === "empty") {
    return (
      <ReviewHeader>
        <h1 className="mt-5 text-2xl font-semibold tracking-heading text-text-primary sm:text-3xl">Nothing to review</h1>
        <p className="mt-1 text-sm text-text-secondary">When an agent suggests changes to your library, they appear here. Past changes and Undo are in Settings, Agents.</p>
        <Link href="/" className={buttonClassName({ variant: "primary", className: "mt-5" })}>Open library</Link>
      </ReviewHeader>
    );
  }

  const ready = loaded;
  async function decide(action: () => Promise<{ outcome: ReviewOutcome; changeId?: string }>) {
    setBusy(true);
    setError(null);
    finished.current = true;
    try {
      setDone(await action());
      setLoaded(await load());
    } catch (error) {
      finished.current = false;
      setError(error instanceof Error ? error.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error ? <p role="alert" className="mb-4 text-sm text-text-danger">{error}</p> : null}
      <AgentReviewPanel
      agentName={ready.agentName}
      createdAt={ready.createdAt}
      now={now}
      groups={ready.groups}
      items={ready.items}
      conflicts={ready.conflicts}
      excluded={excluded}
      backupFolder={ready.backupFolder}
      busy={busy}
      onToggle={(keys, include) => setExcluded((current) => {
        const next = new Set(current);
        for (const key of keys) {
          if (include) next.delete(key);
          else next.add(key);
        }
        return next;
      })}
      onApply={() => void decide(async () => {
        const result = await applyAgentProposal(ready.proposalId, [...excluded]);
        return {
          changeId: result.changeId,
          outcome: { agentName: ready.agentName, applied: result.effects ?? result.applied.length, skipped: result.skipped, backup: result.backup, undone: null, declined: false },
        };
      })}
      onDecline={() => void decide(async () => {
        await rejectAgentProposal(ready.proposalId);
        return { outcome: { agentName: ready.agentName, applied: 0, skipped: [], backup: { status: "off" }, undone: null, declined: true } };
      })}
      />
    </>
  );
}
