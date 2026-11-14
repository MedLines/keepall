import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { itemsByType } from "../../.storybook/fixtures";
import { ItemTypeIcon } from "./item-type-icon";

const itemOptions = Object.fromEntries(itemsByType.map(({ name, item }) => [name, item]));

const meta = {
  title: "Library/ItemTypeIcon",
  component: ItemTypeIcon,
  args: { item: itemsByType[0].item },
  argTypes: { item: { options: Object.keys(itemOptions), mapping: itemOptions, control: "select" } },
} satisfies Meta<typeof ItemTypeIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** One glyph and color per type: PDF red, TXT blue, MD purple, notes amber, images green, links cyan, videos pink. */
export const AllTypes: Story = {
  render: () => (
    <ul className="grid grid-cols-2 gap-3 text-sm text-text-primary">
      {itemsByType.map(({ name, item }) => (
        <li key={name} className="flex items-center gap-2"><ItemTypeIcon item={item} />{name}</li>
      ))}
    </ul>
  ),
};
