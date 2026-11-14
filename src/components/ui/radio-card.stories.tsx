import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent } from "storybook/test";
import { RadioCard } from "./radio-card";

const meta = {
  title: "UI/RadioCard",
  component: RadioCard,
  args: { name: "story-collection", className: "w-96 text-text-primary", children: "Keep in “Weekend recipes”" },
  argTypes: { children: { control: "text" } },
} satisfies Meta<typeof RadioCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {};
export const Checked: Story = { args: { defaultChecked: true } };

export const WithDescription: Story = {
  args: {
    children: (
      <span className="grid gap-1">
        <span>Move to “Reading list”</span>
        <span className="text-text-secondary">The item leaves its current collection.</span>
      </span>
    ),
  },
};

export const Group: Story = {
  render: (args) => (
    <fieldset className="grid w-96 gap-2">
      <legend className="mb-2 text-sm font-medium text-text-primary">Collection</legend>
      <RadioCard {...args} className="text-text-primary" defaultChecked>Keep in “Weekend recipes”</RadioCard>
      <RadioCard {...args} className="text-text-primary">Move to “Reading list”</RadioCard>
      <RadioCard {...args} className="text-text-primary" disabled>Remove from all collections</RadioCard>
    </fieldset>
  ),
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async () => {
    await userEvent.tab();
  },
};
export const Disabled: Story = { args: { disabled: true } };
export const DisabledChecked: Story = { args: { disabled: true, defaultChecked: true } };
