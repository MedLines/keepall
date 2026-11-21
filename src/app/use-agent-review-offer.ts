"use client";

import { useEffect, useState } from "react";
import { agentDisplayName } from "@/domain/agent-review";
import { AGENT_CHANGES_CHANNEL, listOpenProposals } from "@/persistence/agent-changes";

export const AGENT_REVIEW_PARAM = "agent-review";

type Offer = { agentName: string; items: number };

async function readOffer(): Promise<Offer | null> {
  const [proposal] = await listOpenProposals();
  if (!proposal) return null;
  const items = new Set(proposal.requests.flatMap((entry) => ("itemIds" in entry.request ? entry.request.itemIds : entry.request.kind === "note" ? [entry.request.itemId] : [])));
  const decided = new Set(proposal.decidedItems ?? []);
  return { agentName: agentDisplayName(proposal.agentName), items: [...items].filter((id) => !decided.has(id)).length || 1 };
}

/**
 * Whether an agent's suggestions wait for review, kept current as agents suggest more. The agent's review link
 * (`/?agent-review=1`) opens the review straight away and drops the parameter from the address.
 */
export function useAgentReviewOffer() {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has(AGENT_REVIEW_PARAM)) {
      url.searchParams.delete(AGENT_REVIEW_PARAM);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      readOffer().then((next) => {
        setOffer(next);
        setOpen(!!next);
      }, () => {});
    } else {
      readOffer().then(setOffer, () => {});
    }
    const channel = new BroadcastChannel(AGENT_CHANGES_CHANNEL);
    channel.onmessage = () => void readOffer().then(setOffer, () => {});
    return () => channel.close();
  }, []);

  return { offer, open, setOpen };
}
