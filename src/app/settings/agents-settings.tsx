"use client";

import { useCallback, useEffect, useState } from "react";
import type { AgentAccess } from "@/domain/agent-changes";
import {
  AGENT_CHANGES_CHANNEL, listAgentChanges, listOpenProposals, rejectAgentProposal, undoAgentChange,
} from "@/persistence/agent-changes";
import { AGENT_PAIRINGS_CHANNEL, deleteAgentPairing, listAgentPairings, pairingAccess, setAgentPairingAccess } from "@/persistence/agent-pairings";
import { agentDisplayName, digestChanges } from "@/domain/agent-review";
import { nameIndex } from "@/domain/agent-tools";
import type { AgentChangeEntry } from "@/persistence/agent-changes";
import { listCollections } from "@/persistence/collections";
import { listTags } from "@/persistence/tags";
import { AgentsPanel, type ActivityView, type AgentsPanelProps } from "./agents-panel";

type Data = Pick<AgentsPanelProps, "proposals" | "activities" | "pairings">;
const EMPTY: Data = { proposals: [], activities: [], pairings: [] };

/**
 * Groups journal entries the way they happened: every item applied in one review is one activity, and each agent
 * call that applied directly is its own. Entries arrive newest first.
 */
function activities(entries: readonly AgentChangeEntry[], names: ReturnType<typeof nameIndex>): ActivityView[] {
  const groups = new Map<string, AgentChangeEntry[]>();
  for (const entry of entries) {
    const key = entry.proposalId ?? entry.id;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return [...groups].map(([key, group]) => {
    const oldestFirst = [...group].reverse();
    const owner = new Map<string, AgentChangeEntry>();
    for (const entry of oldestFirst) for (const record of entry.records) if (record.table === "items") owner.set(record.id, entry);
    const digest = digestChanges(oldestFirst.map((entry) => entry.records), names);
    const undone = group.filter((entry) => entry.undoneAt);
    return {
      id: key,
      agentName: group[0].agentName,
      createdAt: group[0].createdAt,
      summary: digest.summary,
      items: digest.items.map(({ item, changes }) => {
        const entry = owner.get(item.id)!;
        return { item, changes, entryId: entry.id, undone: !!entry.undoneAt, alone: entry.records.filter((record) => record.table === "items").length === 1 };
      }),
      undoable: group.filter((entry) => !entry.undoneAt).map((entry) => entry.id),
      undoneAt: undone.length === group.length ? Math.max(...undone.map((entry) => entry.undoneAt!)) : undefined,
      undoKept: group.flatMap((entry) => entry.undoKept ?? []),
    };
  });
}

async function load(): Promise<Data> {
  const [proposals, changes, pairings, tags, collections] = await Promise.all([listOpenProposals(), listAgentChanges(80), listAgentPairings(), listTags(), listCollections()]);
  return {
    proposals: proposals.map(({ id, agentName, createdAt, requests }) => ({ id, agentName, createdAt, requests: requests.map(({ id: requestId, text }) => ({ id: requestId, text })) })),
    activities: activities(changes, nameIndex(tags, collections)),
    pairings: pairings.map((pairing) => ({ id: pairing.id, agentName: pairing.agentName, createdAt: pairing.createdAt, lastUsedAt: pairing.lastUsedAt, access: pairingAccess(pairing) })),
  };
}

function announcePairings() {
  const channel = new BroadcastChannel(AGENT_PAIRINGS_CHANNEL);
  channel.postMessage("changed");
  channel.close();
}

export function AgentsSettings() {
  const [data, setData] = useState<Data>(EMPTY);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<AgentsPanelProps["status"]>(null);
  const [now, setNow] = useState(() => Date.now());

  const show = useCallback((next: Data | null) => {
    if (next) setData(next);
    setNow(Date.now());
  }, []);
  const refresh = useCallback(() => load().catch(() => null).then(show), [show]);

  useEffect(() => {
    // Suggestions arrive from the agent host in another context; both channels mean "reload".
    const channels = [AGENT_CHANGES_CHANNEL, AGENT_PAIRINGS_CHANNEL].map((name) => new BroadcastChannel(name));
    for (const channel of channels) channel.onmessage = () => void refresh();
    load().catch(() => null).then(show);
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      for (const channel of channels) channel.close();
      window.clearInterval(timer);
    };
  }, [refresh, show]);

  async function run(id: string, action: () => Promise<AgentsPanelProps["status"]>) {
    setBusy(id);
    try {
      setStatus(await action());
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "That didn't work. Try again." });
    } finally {
      setBusy(null);
      await refresh();
    }
  }

  return (
    <AgentsPanel
      {...data}
      busy={busy}
      status={status}
      now={now}
      onUndo={(changeIds, key) => void run(key, async () => {
        const kept: string[] = [];
        // Newest first, so each undo restores the state the next older change left.
        for (const changeId of changeIds) kept.push(...(await undoAgentChange(changeId)).kept);
        return { text: kept.length ? "Undone, except where you'd made changes since." : "Undone.", details: kept };
      })}
      onAccess={(pairingId, access: AgentAccess) => {
        // Show the choice at once; the refresh after saving confirms it.
        setData((current) => ({ ...current, pairings: current.pairings.map((pairing) => (pairing.id === pairingId ? { ...pairing, access } : pairing)) }));
        void run(pairingId, async () => {
          await setAgentPairingAccess(pairingId, access);
          return null;
        });
      }}
      onDisconnect={(pairingId) => void run(pairingId, async () => {
        const name = data.pairings.find((pairing) => pairing.id === pairingId)?.agentName ?? "The agent";
        await deleteAgentPairing(pairingId);
        for (const proposal of await listOpenProposals()) {
          if (proposal.pairingId === pairingId) await rejectAgentProposal(proposal.id);
        }
        announcePairings();
        return { text: `Disconnected ${agentDisplayName(name)}. It can't reach this library any more. Its past changes stay listed with Undo.` };
      })}
    />
  );
}
