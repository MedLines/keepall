import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent } from "storybook/test";
import { PlusIcon } from "@/app/shell-icons";
import { Button } from "./button";

const meta = {
  title: "UI/Button",
  component: Button,
  args: { children: "Save changes", onClick: fn() },
  argTypes: {
    variant: { control: "inline-radio", options: ["secondary", "primary", "danger", "danger-ghost"] },
    size: { control: "inline-radio", options: ["md", "lg", "toolbar", "none"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Secondary: Story = { args: { variant: "secondary" } };
export const Primary: Story = { args: { variant: "primary" } };
export const Danger: Story = { args: { variant: "danger", children: "Delete forever" } };
export const DangerGhost: Story = { args: { variant: "danger-ghost", children: "Empty Trash" } };

export const SizeMedium: Story = { args: { size: "md" } };
export const SizeLarge: Story = { args: { size: "lg" } };
/** Toolbar keeps padding with the caller because it depends on whether an icon leads. */
export const SizeToolbar: Story = {
  args: { size: "toolbar", className: "px-4", children: <><PlusIcon />Add</> },
};
/** `none` adds no size classes; the caller sets height, padding and type. */
export const SizeNone: Story = { args: { size: "none", className: "h-8 px-3 text-xs" } };

export const Hover: Story = {
  render: (args) => (
    <div className="flex gap-2">
      <Button {...args} variant="secondary" />
      <Button {...args} variant="primary" />
      <Button {...args} variant="danger" />
      <Button {...args} variant="danger-ghost" />
    </div>
  ),
  parameters: { pseudo: { hover: true } },
};

export const Focus: Story = {
  play: async () => {
    await userEvent.tab();
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <div className="flex gap-2">
      <Button {...args} variant="secondary" />
      <Button {...args} variant="primary" />
      <Button {...args} variant="danger" />
      <Button {...args} variant="danger-ghost" />
    </div>
  ),
};

export const AllVariantsAndSizes: Story = {
  render: (args) => (
    <div className="grid gap-3">
      {(["md", "lg"] as const).map(size => (
        <div key={size} className="flex gap-2">
          <Button {...args} size={size} variant="secondary" />
          <Button {...args} size={size} variant="primary" />
          <Button {...args} size={size} variant="danger" />
          <Button {...args} size={size} variant="danger-ghost" />
        </div>
      ))}
    </div>
  ),
};
