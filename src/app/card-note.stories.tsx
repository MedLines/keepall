import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent } from "storybook/test";
import { CardNote } from "./library-card-details";

const note = "Read the section on anemones before Saturday, and bring the tide table.";

// Shown inside a card-width surface, as in a card footer.
const meta = {
  title: "Library/CardNote",
  component: CardNote,
  args: { content: note, title: "A beginner’s guide to tide pools", onOpen: fn() },
  decorators: [(Story) => <div className="library-card grid w-80 gap-1.5 rounded-panel p-4 text-meta text-text-secondary"><Story /></div>],
} satisfies Meta<typeof CardNote>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Markdown: Story = { args: { content: "**Bring:** boots, torch", format: "markdown", title: "Packing list" } };
export const AsLink: Story = { args: { openHref: "/items/link-1" } };
export const ReadOnly: Story = { args: { readOnly: true } };
export const SearchMatch: Story = { args: { query: "anemones" } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async () => {
    await userEvent.tab();
  },
};
/** Icon-only notes (list rows) show the excerpt in a tooltip on hover or focus. */
export const IconOnly: Story = {
  args: { iconOnly: true },
  play: async () => {
    await userEvent.tab();
  },
};
/** Renders nothing when there is no note content. */
export const Empty: Story = { args: { content: "  ", title: "Untitled" } };
