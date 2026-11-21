"use client";

import { useEffect, useState } from "react";
import { agentDisplayName } from "@/domain/agent-review";
import { AGENT_CHANGES_CHANNEL, listOpenProposals } from "@/persistence/agent-changes";

/** Links from before the review page existed opened the review in the library; they now lead to /review. */
export const AGENT_REVIEW_PARAM = "agent-review";

export type AgentReviewOffer = { agentName: string; items: number };

export async function readAgentReviewOffer(): Promise<AgentReviewOffer | null> {
  const [proposal] = await listOpenProposals();
  if (!proposal) return null;
  const items = new Set(proposal.requests.flatMap((entry) => ("itemIds" in entry.request ? entry.request.itemIds : entry.request.kind === "note" ? [entry.request.itemId] : [])));
  const decided = new Set(proposal.decidedItems ?? []);
  return { agentName: agentDisplayName(proposal.agentName), items: [...items].filter((id) => !decided.has(id)).length || 1 };
}

/** Whether an agent's suggestions wait for review, kept current as agents suggest more and reviews finish. */
export function useAgentReviewOffer() {
  const [offer, setOffer] = useState<AgentReviewOffer | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has(AGENT_REVIEW_PARAM)) {
      window.location.replace("/review");
      return;
    }
    readAgentReviewOffer().then(setOffer, () => {});
    const channel = new BroadcastChannel(AGENT_CHANGES_CHANNEL);
    channel.onmessage = () => void readAgentReviewOffer().then(setOffer, () => {});
    return () => channel.close();
  }, []);

  return { offer };
}
