import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { planChanges } from "@/domain/agent-changes";
import { groupEffects } from "@/domain/agent-review";
import type { Item } from "@/domain/item";
import { AgentReviewPanel, AgentReviewResult } from "./agent-review-panel";

const now = Date.UTC(2026, 10, 21, 15, 0);
const link = (id: string, title: string, url: string) =>
  ({ id, type: "link", title, url, noteContent: "", previewTitle: "", previewDescription: "", previewImageUrl: "", previewAssetId: null, previewStatus: "failed", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 }) as unknown as Item;
const note = (id: string, title: string, content: string) => ({ id, type: "note", title, content, tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 }) as unknown as Item;
const items = [
  link("grid", "Studio grid study", "https://studio.example/grid"),
  link("type", "Type scale notes", "https://type.example/scale"),
  link("dash", "Dark dashboard", "https://ui.example/dashboard"),
  note("palette", "Palette ideas", "Warm neutrals with one saturated accent."),
  note("junk", "test", "asdf"),
];
let id = 0;
const plan = planChanges({ items, collections: [], tags: [] }, [
  { id: "r1", request: { kind: "move", itemIds: ["grid", "type", "dash", "palette"], collection: "Portfolio inspo" } },
  { id: "r2", request: { kind: "tag", itemIds: ["grid", "dash"], add: ["dark ui", "layout"], remove: [] } },
  { id: "r3", request: { kind: "note", itemId: "palette", text: "About: colour ideas for the portfolio.", replace: false } },
  { id: "r4", request: { kind: "trash", itemIds: ["junk"] } },
], { now, newId: () => `id-${(id += 1)}` });
const groups = groupEffects(plan.steps.map((step) => ({ ...step, reason: step.id === "r2" ? "Both use dark, card-based layouts." : undefined })));

const meta = {
  title: "Agents/AgentReviewPanel",
  component: AgentReviewPanel,
  args: {
    agentName: "Claude Code", createdAt: now - 3 * 60_000, now, groups, items: Object.fromEntries(items.map((item) => [item.id, item])),
    conflicts: [], excluded: new Set<string>(), view: "changes", backupFolder: true, busy: false,
    onView: fn(), onToggle: fn(), onApply: fn(), onDecline: fn(),
  },
  decorators: [(Story) => <div className="max-w-5xl bg-bg-canvas p-4"><Story /></div>],
} satisfies Meta<typeof AgentReviewPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ByChange: Story = {};
export const ByItem: Story = { args: { view: "items" } };
export const SomeUnticked: Story = { args: { excluded: new Set(["dash#tag:add:dark ui", "junk#trash"]) } };
export const WithConflict: Story = { args: { conflicts: ['"Type scale notes" changed in Keepall after this was suggested'] } };
export const Applying: Story = { args: { busy: true } };

export const Applied: Story = {
  render: () => (
    <AgentReviewResult
      busy={false}
      onUndo={fn()}
      outcome={{ agentName: "Claude Code", applied: 9, skipped: [{ text: 'Move "test" to Trash', reason: "Not chosen" }], backup: { status: "saved" }, undone: null, declined: false }}
    />
  ),
};
