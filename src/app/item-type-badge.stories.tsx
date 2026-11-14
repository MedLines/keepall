import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { itemsByType } from "../../.storybook/fixtures";
import { ItemTypeBadge } from "./item-type-icon";

const itemOptions = Object.fromEntries(itemsByType.map(({ name, item }) => [name, item]));

const meta = {
  title: "Library/ItemTypeBadge",
  component: ItemTypeBadge,
  args: { item: itemsByType[0].item },
  argTypes: {
    item: { options: Object.keys(itemOptions), mapping: itemOptions, control: "select" },
    variant: { control: "inline-radio", options: ["card", "list"] },
  },
  // Single badges sit in a preview-sized frame; the all-types stories draw their own.
  render: (args) => <div className="relative h-24 w-32 overflow-hidden rounded-panel bg-bg-raised"><ItemTypeBadge {...args} /></div>,
} satisfies Meta<typeof ItemTypeBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Card: Story = {};
export const Gallery: Story = { args: { item: itemOptions["Gallery"] } };
export const LinkWithScreenshots: Story = { args: { item: itemOptions["Link with screenshots"] } };

/** Card badges sit at the bottom-end of the preview, on the media chrome surface. */
export const AllTypesOnCard: Story = {
  render: () => (
    <ul className="grid grid-cols-5 gap-3">
      {itemsByType.map(({ name, item }) => (
        <li key={name} className="relative h-24 w-32 overflow-hidden rounded-panel bg-bg-raised" aria-label={name}>
          <ItemTypeBadge item={item} />
        </li>
      ))}
    </ul>
  ),
};

export const AllTypesInList: Story = {
  render: () => (
    <ul className="grid gap-2 text-sm text-text-secondary">
      {itemsByType.map(({ name, item }) => (
        <li key={name} className="flex items-center gap-2"><ItemTypeBadge item={item} variant="list" />{name}</li>
      ))}
    </ul>
  ),
};
