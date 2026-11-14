import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent } from "storybook/test";
import { CloseIcon, DeleteIcon, MoreIcon } from "@/app/shell-icons";
import { IconButton } from "./button";

const meta = {
  title: "UI/IconButton",
  component: IconButton,
  args: { "aria-label": "More actions", children: <MoreIcon />, onClick: fn() },
  argTypes: {
    variant: { control: "inline-radio", options: ["secondary", "primary", "danger", "danger-ghost"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    children: { control: false },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Secondary: Story = { args: { variant: "secondary" } };
export const Primary: Story = { args: { variant: "primary" } };
export const Danger: Story = { args: { variant: "danger", "aria-label": "Delete", children: <DeleteIcon /> } };
export const DangerGhost: Story = { args: { variant: "danger-ghost", "aria-label": "Delete", children: <DeleteIcon /> } };

export const SizeSmall: Story = { args: { size: "sm" } };
/** 40px, the dialog close button. */
export const SizeMedium: Story = { args: { size: "md", "aria-label": "Close", children: <CloseIcon /> } };
/** 44px, the library top bar. */
export const SizeLarge: Story = { args: { size: "lg" } };

export const Hover: Story = {
  render: (args) => (
    <div className="flex gap-2">
      <IconButton {...args} variant="secondary" />
      <IconButton {...args} variant="primary" />
      <IconButton {...args} variant="danger" />
      <IconButton {...args} variant="danger-ghost" />
    </div>
  ),
  parameters: { pseudo: { hover: true } },
};

export const Focus: Story = {
  play: async () => {
    await userEvent.tab();
  },
};

export const Disabled: Story = { args: { disabled: true } };

export const AllSizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <IconButton {...args} size="sm" />
      <IconButton {...args} size="md" />
      <IconButton {...args} size="lg" />
    </div>
  ),
};
