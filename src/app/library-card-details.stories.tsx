import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent } from "storybook/test";
import { CardSource } from "./library-card-details";

// Shown inside a card-width surface, as in a card footer.
const meta = {
  title: "Library/CardSource",
  component: CardSource,
  args: { url: "https://tidepools.example/guide" },
  decorators: [(Story) => <div className="library-card grid w-80 gap-1.5 rounded-panel p-4 text-meta text-text-secondary"><Story /></div>],
} satisfies Meta<typeof CardSource>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithoutFavicon: Story = { args: { showFavicon: false } };
export const SearchMatch: Story = { args: { query: "tidepools" } };
/** Older imports can store a raw label instead of a URL. */
export const RawLabel: Story = { args: { url: "Saved from a shared folder" } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async () => {
    await userEvent.tab();
  },
};
