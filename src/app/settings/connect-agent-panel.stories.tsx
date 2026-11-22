import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";
import { DEFAULT_MCP_COMMAND, setupInstructions } from "@/domain/agent-setup";
import { ConnectAgentPanel } from "./connect-agent-panel";

const code = "keepall_eyJ2IjoxLCJyIjoiaHR0cHM6Ly9yZWxheS5leGFtcGxlIn0";

const meta = {
  title: "Settings/ConnectAgentPanel",
  component: ConnectAgentPanel,
  args: {
    available: true, agent: "claude-code", access: "suggest", busy: false, created: null, error: null,
    onAgent: fn(), onAccess: fn(), onCreate: fn(), onReset: fn(),
  },
  decorators: [(Story) => <div className="grid max-w-3xl gap-4 bg-bg-canvas p-4"><Story /></div>],
} satisfies Meta<typeof ConnectAgentPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ChooseAgent: Story = {
  play: async ({ canvas, args }) => {
    await canvas.getByRole("radio", { name: "Codex" }).click();
    await expect(args.onAgent).toHaveBeenCalledWith("codex");
    await canvas.getByRole("button", { name: "Create setup" }).click();
    await expect(args.onCreate).toHaveBeenCalled();
  },
};

export const ClaudeCodeCommand: Story = {
  args: { created: { agentName: "Claude Code", instructions: setupInstructions("claude-code", DEFAULT_MCP_COMMAND, code) } },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText(/claude mcp add -s user keepall/)).toBeVisible();
    await canvas.getByRole("button", { name: "Set up another agent" }).click();
    await expect(args.onReset).toHaveBeenCalled();
  },
};

export const OpenCodeConfig: Story = {
  args: { agent: "opencode", created: { agentName: "OpenCode", instructions: setupInstructions("opencode", DEFAULT_MCP_COMMAND, code) } },
};

export const Creating: Story = { args: { busy: true } };
export const Failed: Story = { args: { error: "Couldn't create the setup. Try again." } };
export const Unavailable: Story = { args: { available: false } };
