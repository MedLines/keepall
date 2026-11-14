import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SearchHighlight } from "./search-highlight";

const meta = {
  title: "Library/SearchHighlight",
  component: SearchHighlight,
  args: { text: "A beginner’s guide to tide pools and the anemones that live in them", query: "tide" },
  decorators: [(Story) => <p className="w-96 text-sm text-text-primary"><Story /></p>],
} satisfies Meta<typeof SearchHighlight>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Match: Story = {};
export const SeveralTerms: Story = { args: { query: "tide anemones" } };
export const NoMatch: Story = { args: { query: "kelp" } };
export const EmptyQuery: Story = { args: { query: "" } };
