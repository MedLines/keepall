"use client";

import { useEffect } from "react";
import { AGENT_CHANGES_CHANNEL } from "@/persistence/agent-changes";
import { hostAgents } from "./extension-bridge/agent-host";
import { ITEMS_CHANGED_EVENT } from "./items-events";

/**
 * Lets an open Keepall tab answer paired agents when the extension's bridge isn't running, and reloads the
 * library when an agent's change lands, whichever context applied it.
 */
export function AgentHostRunner() {
  useEffect(() => {
    // The extension bridge frame hosts agents itself.
    if (window.self !== window.top) return;
    const stopHost = hostAgents();
    const changes = typeof BroadcastChannel === "undefined" ? undefined : new BroadcastChannel(AGENT_CHANGES_CHANNEL);
    if (changes) changes.onmessage = () => window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    return () => {
      stopHost();
      changes?.close();
    };
  }, []);
  return null;
}
