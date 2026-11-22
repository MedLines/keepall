import { DEFAULT_MCP_COMMAND } from "@/domain/agent-setup";

/**
 * The relay agents reach this library through. Production sets NEXT_PUBLIC_KEEPALL_RELAY_URL at build time;
 * local development uses the relay from `pnpm --filter @keepall/relay dev`.
 */
export function agentRelayUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_KEEPALL_RELAY_URL;
  if (configured) return configured;
  return ["localhost", "127.0.0.1"].includes(window.location.hostname) ? "http://localhost:8787" : null;
}

/** The command agents launch. NEXT_PUBLIC_KEEPALL_MCP_COMMAND points development builds at a local checkout. */
export function mcpCommand(): string[] {
  const custom = process.env.NEXT_PUBLIC_KEEPALL_MCP_COMMAND;
  return custom ? custom.split(/\s+/).filter(Boolean) : DEFAULT_MCP_COMMAND;
}
