"use client";

import { useCallback, useEffect, useState } from "react";
import type { AgentAccess } from "@/domain/agent-changes";
import {
  AGENT_CHANGES_CHANNEL, listAgentChanges, listOpenProposals, rejectAgentProposal, undoAgentChange,
} from "@/persistence/agent-changes";
import { AGENT_PAIRINGS_CHANNEL, deleteAgentPairing, listAgentPairings, pairingAccess, setAgentPairingAccess } from "@/persistence/agent-pairings";
import { agentDisplayName } from "@/domain/agent-review";
import { AgentsPanel, type AgentsPanelProps } from "./agents-panel";

type Data = Pick<AgentsPanelProps, "proposals" | "changes" | "pairings">;
const EMPTY: Data = { proposals: [], changes: [], pairings: [] };

async function load(): Promise<Data> {
  const [proposals, changes, pairings] = await Promise.all([listOpenProposals(), listAgentChanges(), listAgentPairings()]);
  return {
    proposals: proposals.map(({ id, agentName, createdAt, requests }) => ({ id, agentName, createdAt, requests: requests.map(({ id: requestId, text }) => ({ id: requestId, text })) })),
    changes: changes.map(({ id, agentName, createdAt, steps, undoneAt, undoKept }) => ({ id, agentName, createdAt, steps, undoneAt, undoKept })),
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
      onUndo={(changeId) => void run(changeId, async () => {
        const result = await undoAgentChange(changeId);
        return { text: result.kept.length ? "Undone, except where you'd made changes since." : "Undone.", details: result.kept };
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
