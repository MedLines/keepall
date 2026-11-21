// The exact thing to paste for each agent, built from a setup code. Pure strings, so each format is tested.

export const SETUP_AGENTS = ["claude-code", "codex", "opencode", "claude-desktop", "other"] as const;
export type SetupAgent = typeof SETUP_AGENTS[number];

export const SETUP_AGENT_NAMES: Record<SetupAgent, string> = {
  "claude-code": "Claude Code", codex: "Codex", opencode: "OpenCode", "claude-desktop": "Claude Desktop", other: "Another agent",
};

/** The default launcher. Development builds can point at a local checkout instead. */
export const DEFAULT_MCP_COMMAND = ["npx", "-y", "@keepall/mcp@1"];

export type SetupInstructions = {
  /** What to do with `text`, in words. */
  where: string;
  text: string;
  format: "shell" | "json";
  /** What to do after. */
  then: string;
};

function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function setupInstructions(agent: SetupAgent, command: readonly string[], code: string): SetupInstructions {
  const launch = [...command, "--code", code];
  switch (agent) {
    case "claude-code":
      return { where: "Run this in a terminal:", text: `claude mcp add -s user keepall -- ${launch.join(" ")}`, format: "shell", then: "Then start a new Claude Code session and ask it to search Keepall." };
    case "codex":
      return { where: "Run this in a terminal:", text: `codex mcp add keepall -- ${launch.join(" ")}`, format: "shell", then: "Then start Codex again and ask it to search Keepall." };
    case "opencode":
      return {
        where: "Add this to opencode.json, in your project or in ~/.config/opencode:",
        text: json({ $schema: "https://opencode.ai/config.json", mcp: { keepall: { type: "local", command: launch, enabled: true } } }),
        format: "json", then: "Then restart OpenCode and ask it to search Keepall.",
      };
    case "claude-desktop":
      return {
        where: "In Claude Desktop, open Settings, Developer, Edit Config, and add this to claude_desktop_config.json:",
        text: json({ mcpServers: { keepall: { command: launch[0], args: launch.slice(1) } } }),
        format: "json", then: "Then quit and reopen Claude Desktop. This needs Node.js 22 or newer.",
      };
    case "other":
      return {
        where: "Run this as a stdio MCP server in your agent's settings:",
        text: launch.join(" "),
        format: "shell", then: "Any agent that supports MCP servers over stdio works.",
      };
  }
}
