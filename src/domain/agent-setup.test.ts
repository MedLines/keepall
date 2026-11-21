import { describe, expect, it } from "vitest";
import { DEFAULT_MCP_COMMAND, setupInstructions } from "./agent-setup";

const code = "keepall_abc-123";

describe("setupInstructions", () => {
  it("gives each agent its own one-step setup", () => {
    expect(setupInstructions("claude-code", DEFAULT_MCP_COMMAND, code).text).toBe("claude mcp add -s user keepall -- npx -y @keepall/mcp@1 --code keepall_abc-123");
    expect(setupInstructions("codex", DEFAULT_MCP_COMMAND, code).text).toBe("codex mcp add keepall -- npx -y @keepall/mcp@1 --code keepall_abc-123");
    expect(JSON.parse(setupInstructions("opencode", DEFAULT_MCP_COMMAND, code).text).mcp.keepall).toEqual({ type: "local", command: ["npx", "-y", "@keepall/mcp@1", "--code", code], enabled: true });
    expect(JSON.parse(setupInstructions("claude-desktop", DEFAULT_MCP_COMMAND, code).text).mcpServers.keepall).toEqual({ command: "npx", args: ["-y", "@keepall/mcp@1", "--code", code] });
    expect(setupInstructions("other", ["node", "/srv/cli.ts"], code).text).toBe("node /srv/cli.ts --code keepall_abc-123");
  });
});
