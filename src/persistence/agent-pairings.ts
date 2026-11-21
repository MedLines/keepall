import type { AgentAccess } from "@/domain/agent-changes";
import { getDb } from "./db";

/** One paired agent. `id` is the relay channel ID. */
export type AgentPairing = {
  id: string;
  relayUrl: string;
  agentName: string;
  pairKey: Uint8Array<ArrayBuffer>;
  createdAt: number;
  lastUsedAt?: number;
  /** Missing on pairings made before agents could change anything: read only. */
  access?: AgentAccess;
};

export function pairingAccess(pairing: Pick<AgentPairing, "access">): AgentAccess {
  return pairing.access ?? "read";
}

/** Same-origin pages announce pairing changes here so a running host reconnects. */
export const AGENT_PAIRINGS_CHANNEL = "keepall-agent-pairings";

export async function listAgentPairings(): Promise<AgentPairing[]> {
  return getDb().agentPairings.orderBy("id").toArray();
}

export async function saveAgentPairing(pairing: AgentPairing): Promise<void> {
  await getDb().agentPairings.put(pairing);
}

export async function deleteAgentPairing(id: string): Promise<void> {
  await getDb().agentPairings.delete(id);
}

export async function getAgentPairing(id: string): Promise<AgentPairing | undefined> {
  return getDb().agentPairings.get(id);
}

export async function setAgentPairingAccess(id: string, access: AgentAccess): Promise<void> {
  await getDb().agentPairings.update(id, { access });
}

export async function touchAgentPairing(id: string, now = Date.now()): Promise<void> {
  await getDb().agentPairings.update(id, { lastUsedAt: now });
}
