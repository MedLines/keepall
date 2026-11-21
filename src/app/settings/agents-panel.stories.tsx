import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { AgentsPanel } from "./agents-panel";

const now = Date.UTC(2026, 10, 21, 15, 0);
const minutes = (count: number) => now - count * 60_000;

const meta = {
  title: "Settings/AgentsPanel",
  component: AgentsPanel,
  args: {
    now,
    busy: null,
    status: null,
    backupFolder: true,
    proposals: [{
      id: "proposal-1", agentName: "Claude Code", createdAt: minutes(4),
      requests: [
        { id: "r1", text: 'Move "Studio grid study" and 6 more to "Portfolio inspo" (new collection)' },
        { id: "r2", text: 'Tags on "Dashboard sidebar" and 3 more: add "dashboards", "dark mode"' },
        { id: "r3", text: 'Add a note to "Type scale notes": "Use the 1.25 ratio for headings"' },
        { id: "r4", text: 'Move "Old landing page" to Trash' },
      ],
    }],
    changes: [
      { id: "c1", agentName: "Codex", createdAt: minutes(42), steps: ['Save link "Spacing systems" to "Reading", tagged "layout"'] },
      {
        id: "c2", agentName: "Claude Code", createdAt: minutes(180), undoneAt: minutes(170),
        steps: ['Rename collection "Misc" to "Inbox"', 'Tags on "Hero ideas": add "hero"'],
        undoKept: ['"Hero ideas" was changed again after the agent\'s edit, so it was left as it is'],
      },
    ],
    pairings: [
      { id: "p1", agentName: "Claude Code", createdAt: minutes(60 * 24 * 3), lastUsedAt: minutes(4), access: "suggest" },
      { id: "p2", agentName: "Codex", createdAt: minutes(60 * 30), lastUsedAt: minutes(42), access: "change" },
    ],
    onApply: fn(), onDecline: fn(), onUndo: fn(), onAccess: fn(), onDisconnect: fn(),
  },
  decorators: [(Story) => <div className="grid max-w-3xl gap-4 bg-bg-canvas p-4"><Story /></div>],
} satisfies Meta<typeof AgentsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WaitingForReview: Story = {};

export const Applying: Story = { args: { busy: "proposal-1" } };

export const AfterApply: Story = {
  args: {
    proposals: [],
    status: {
      text: "Saved a backup to your folder first. Applied 3 changes, skipped 1. Undo it under Recent changes.",
      details: ['Move "Old landing page" to Trash: "Old landing page" changed in Keepall after this was suggested'],
    },
  },
};

export const Empty: Story = { args: { proposals: [], changes: [], pairings: [] } };
