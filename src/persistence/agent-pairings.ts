import type { AgentAccess } from "@/domain/agent-changes";
import { formatSetupCode, newSetupCode, setupCodePairKey } from "@/domain/agent-protocol";
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
  /** For pairings made in Keepall: the setup code, so its command can be shown again. */
  setupCode?: string;
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

/**
 * Makes a pairing in Keepall, before the agent has run. The library starts listening on the new channel right
 * away; the agent connects the first time it starts with the code.
 */
export async function createSetupPairing(input: { agentName: string; access: AgentAccess; relayUrl: string; appOrigin: string }): Promise<AgentPairing> {
  const code = newSetupCode(input.relayUrl, input.appOrigin);
  const pairing: AgentPairing = {
    id: code.channelId, relayUrl: code.relayUrl, agentName: input.agentName, pairKey: await setupCodePairKey(code),
    createdAt: Date.now(), access: input.access, setupCode: formatSetupCode(code),
  };
  await getDb().agentPairings.put(pairing);
  return pairing;
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
