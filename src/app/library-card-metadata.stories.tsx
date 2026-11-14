import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "storybook/test";
import { collections, longCollection, tags } from "../../.storybook/fixtures";
import { LibraryCardMetadata } from "./library-card-content";

const meta = {
  title: "Library/LibraryCardMetadata",
  component: LibraryCardMetadata,
  args: { collections, tags, onBrowseCollection: fn(), onBrowseTag: fn(), onRemoveTag: fn() },
  decorators: [(Story) => <div className="library-card w-80 rounded-panel p-4"><Story /></div>],
} satisfies Meta<typeof LibraryCardMetadata>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CollectionAndTags: Story = {};
export const CollectionOnly: Story = { args: { tags: [] } };
export const TagsOnly: Story = { args: { collections: [] } };
export const OneTag: Story = { args: { tags: tags.slice(0, 1) } };
export const LongCollectionName: Story = { args: { collections: longCollection } };
/** Renders nothing without collections or tags. */
export const Empty: Story = { args: { collections: [], tags: [] } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async () => {
    await userEvent.tab();
  },
};
export const TagsExpanded: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "3 tags" }));
  },
};
