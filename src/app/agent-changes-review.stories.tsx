import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";
import { NoteSuggestion, ReviewFooter, SuggestionSummary, TrashSuggestion } from "./agent-changes-review";

/** The parts of the one-at-a-time agent review that sit beside the organize panel and in the footer. */
const meta = {
  title: "Agents/AgentChangesReview",
  component: SuggestionSummary,
  args: {
    agentName: "Claude Code",
    effects: [
      { kind: "collection", key: "pin#collection", itemId: "pin", to: "Design Inspiration", isNew: true },
      { kind: "tag", key: "pin#tag:add:dark ui", itemId: "pin", tag: "dark ui", op: "add" },
    ],
    reasons: ["These pins all show dark-themed interfaces."],
  },
  decorators: [(Story) => <div className="grid w-[40rem] gap-3 bg-bg-surface p-4"><Story /></div>],
} satisfies Meta<typeof SuggestionSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Suggested: Story = {};

const decision = { collection: "Design Inspiration", tags: ["dark ui"], note: "About: colour ideas.", trash: false };

export const NoteToAdd: Story = {
  render: () => {
    const update = fn();
    return <NoteSuggestion effect={{ kind: "note", key: "n", itemId: "pin", before: "Warm neutrals.", after: "Warm neutrals.\n\nAbout: colour ideas." }} decision={decision} busy={false} update={update} />;
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Add to the note")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Leave out" })).toBeEnabled();
  },
};

export const NoteReplaced: Story = {
  render: () => <NoteSuggestion effect={{ kind: "note", key: "n", itemId: "pin", before: "My own words.", after: "Agent summary." }} decision={{ ...decision, note: "Agent summary." }} busy={false} update={fn()} />,
};

export const NoteLeftOut: Story = {
  render: () => <NoteSuggestion effect={{ kind: "note", key: "n", itemId: "pin", before: "", after: "About: colour ideas." }} decision={{ ...decision, note: null }} busy={false} update={fn()} />,
};

export const TrashSuggested: Story = {
  render: () => <TrashSuggestion agentName="Claude Code" decision={{ ...decision, trash: true }} busy={false} update={fn()} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Claude Code suggests moving this to Trash.")).toBeVisible();
  },
};

export const TrashDeclined: Story = {
  render: () => <TrashSuggestion agentName="Claude Code" decision={decision} busy={false} update={fn()} />,
};

export const Footer: Story = {
  render: () => {
    const apply = fn();
    return (
      <ReviewFooter busy={false} canBack={false} canNext onBack={fn()} onNext={fn()} canUndo={false} onUndo={fn()} notice="" error={null}
        primary={{ label: "Apply changes", icon: "check", onClick: apply }} />
    );
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Previous item" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Undo" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Apply changes" })).toBeEnabled();
  },
};

export const FooterWithError: Story = {
  render: () => (
    <ReviewFooter busy={false} canBack canNext={false} onBack={fn()} onNext={fn()} canUndo onUndo={fn()} notice="" error="This item is no longer in your library."
      primary={{ label: "Apply changes", icon: "check", onClick: fn() }} />
  ),
};
