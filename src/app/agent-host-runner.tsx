"use client";

import { useEffect } from "react";
import { hostAgents } from "./extension-bridge/agent-host";

/** Lets an open Keepall tab answer paired agents when the extension's bridge isn't running. */
export function AgentHostRunner() {
  // The extension bridge frame hosts agents itself.
  useEffect(() => (window.self === window.top ? hostAgents() : undefined), []);
  return null;
}
