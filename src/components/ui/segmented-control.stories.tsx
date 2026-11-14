import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn, userEvent } from "storybook/test";
import { GridIcon, ListIcon, MarkdownIcon, PlainTextIcon } from "@/app/shell-icons";
import { SegmentedControl } from "./segmented-control";

type Format = "plain" | "markdown";
type Layout = "grid" | "list";

const textChoices = [
  { value: "plain", label: "Plain text", icon: <PlainTextIcon /> },
  { value: "markdown", label: "Markdown", icon: <MarkdownIcon /> },
] as const;

const iconChoices = [
  { value: "grid", ariaLabel: "Grid view", icon: <GridIcon />, tooltip: "Grid view" },
  { value: "list", ariaLabel: "List view", icon: <ListIcon />, tooltip: "List view" },
] as const;

const meta = {
  title: "UI/SegmentedControl",
  component: SegmentedControl<Format>,
  args: { label: "Note format", value: "plain", choices: textChoices, onChange: fn(), className: "w-60" },
  argTypes: {
    variant: { control: "inline-radio", options: ["text", "icon"] },
    value: { control: "inline-radio", options: ["plain", "markdown"] },
    tooltipSide: { control: "inline-radio", options: ["top", "bottom", "left", "right"] },
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <SegmentedControl {...args} value={value} onChange={(next) => { setValue(next); args.onChange(next); }} />;
  },
} satisfies Meta<typeof SegmentedControl<Format>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = {};
export const TextEndSelected: Story = { args: { value: "markdown" } };

/** Icon variant with tooltips, as in the library layout switch. */
export const Icon: StoryObj<Meta<typeof SegmentedControl<Layout>>> = {
  render: function Render() {
    const [value, setValue] = useState<Layout>("grid");
    return <SegmentedControl<Layout> variant="icon" label="Library layout" value={value} onChange={setValue} choices={iconChoices} />;
  },
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async () => {
    await userEvent.tab();
  },
};
export const Disabled: Story = { args: { disabled: true } };
