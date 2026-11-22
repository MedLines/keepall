import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";
import type { Item } from "@/domain/item";
import { AgentsPanel } from "./agents-panel";

const now = Date.UTC(2026, 10, 21, 15, 0);
const link = (id: string, title: string, url: string) =>
  ({ id, type: "link", title, url, noteContent: "", previewTitle: "", previewDescription: "", previewImageUrl: "", previewAssetId: null, previewStatus: "failed", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 }) as unknown as Item;
const note = (id: string, title: string, content: string) => ({ id, type: "note", title, content, tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 }) as unknown as Item;
const minutes = (count: number) => now - count * 60_000;

const meta = {
  title: "Settings/AgentsPanel",
  component: AgentsPanel,
  args: {
    now,
    busy: null,
    status: null,
    proposals: [{
      id: "proposal-1", agentName: "claude-code", createdAt: minutes(4),
      requests: [
        { id: "r1", text: 'Move "Studio grid study" and 6 more to "Portfolio inspo" (new collection)' },
        { id: "r2", text: 'Tags on "Dashboard sidebar" and 3 more: add "dashboards", "dark mode"' },
        { id: "r3", text: 'Add a note to "Type scale notes": "Use the 1.25 ratio for headings"' },
        { id: "r4", text: 'Move "Old landing page" to Trash' },
      ],
    }],
    activities: [
      {
        id: "review-1", agentName: "claude-code", createdAt: minutes(2), undoable: ["e2", "e1"],
        summary: ["Moved 2 items to “Portfolio inspo”", "Tagged 3 items: “interviews”, “career”"],
        items: [
          { item: link("a", "Studio grid study", "https://studio.example/grid"), changes: ["→ Portfolio inspo", "+ interviews"], entryId: "e1", undone: false, alone: true },
          { item: link("b", "Type scale notes", "https://type.example/scale"), changes: ["→ Portfolio inspo", "+ career"], entryId: "e2", undone: false, alone: true },
          { item: note("c", "Palette ideas", "Warm neutrals"), changes: ["+ interviews"], entryId: "e2", undone: false, alone: false },
        ],
      },
      {
        id: "call-1", agentName: "codex", createdAt: minutes(180), undoable: [], undoneAt: minutes(170),
        summary: ["Renamed “Misc” to “Inbox”"], items: [], undoKept: ['"Hero ideas" was changed again after the agent\'s edit, so it was left as it is'],
      },
    ],
    pairings: [
      { id: "p1", agentName: "Claude Code", createdAt: minutes(60 * 24 * 3), lastUsedAt: minutes(4), access: "suggest" },
      { id: "p2", agentName: "Codex", createdAt: minutes(60 * 30), lastUsedAt: minutes(42), access: "change" },
    ],
    onUndo: fn(), onAccess: fn(), onDisconnect: fn(),
  },
  decorators: [(Story) => <div className="grid max-w-3xl gap-4 bg-bg-canvas p-4"><Story /></div>],
} satisfies Meta<typeof AgentsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WaitingForReview: Story = {
  play: async ({ canvas, args }) => {
    await canvas.getByRole("button", { name: "Undo all" }).click();
    await expect(args.onUndo).toHaveBeenCalledWith(["e2", "e1"], "review-1");
    await canvas.getByText("Show all 3 items").click();
    await expect(canvas.getByText("→ Portfolio inspo · + interviews")).toBeVisible();
  },
};

export const AfterDisconnect: Story = {
  args: { status: { text: "Disconnected Codex. It can't reach this library any more. Its past changes stay listed with Undo." } },
};

export const Empty: Story = { args: { proposals: [], activities: [], pairings: [] } };
