import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn, userEvent, within } from "storybook/test";
import { FilterIcon, ImageIcon, LinkIcon, NoteIcon, RelevanceIcon, SortAscIcon, SortDescIcon } from "./shell-icons";
import { ShellTopMenu } from "./shell-top-menu";

type Sort = "newest" | "relevance" | "oldest";

const sortOptions = [
  { value: "newest" as const, label: "Newest first", icon: <SortDescIcon /> },
  { value: "relevance" as const, label: "Best match", icon: <RelevanceIcon /> },
  { value: "oldest" as const, label: "Oldest first", icon: <SortAscIcon /> },
];

const meta = {
  title: "Shell/ShellTopMenu",
  component: ShellTopMenu,
  args: { ariaLabel: "Sort", value: "newest", options: sortOptions, onChange: fn() },
  argTypes: { variant: { control: "inline-radio", options: ["toolbar", "field"] } },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <ShellTopMenu<Sort> {...args} value={value} onChange={(next) => { setValue(next); args.onChange(next); }} />;
  },
} satisfies Meta<typeof ShellTopMenu<Sort>>;

export default meta;
type Story = StoryObj<typeof meta>;

const openMenu = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  await userEvent.click(within(canvasElement).getByRole("combobox"));
};

export const Toolbar: Story = {};
export const ToolbarOpen: Story = { play: openMenu };
/** Icon-only trigger, as in the top bar sort control; options keep their labels. */
export const IconOnly: Story = { args: { iconOnly: true } };
export const IconOnlyOpen: Story = { args: { iconOnly: true }, play: openMenu };
export const WithoutCheckmark: Story = { args: { showCheckmark: false }, play: openMenu };
export const Disabled: Story = { args: { disabled: true } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async () => {
    await userEvent.tab();
  },
};

type TypeFilter = "all" | "links" | "notes" | "images";

/** Emphasized when a non-default value is active, with counts beside each option. */
export const EmphasizedWithCounts: StoryObj<Meta<typeof ShellTopMenu<TypeFilter>>> = {
  render: function Render() {
    const [value, setValue] = useState<TypeFilter>("links");
    return <ShellTopMenu<TypeFilter> ariaLabel="Type" value={value} onChange={setValue} emphasized={value !== "all"} triggerIcon={<FilterIcon />}
      options={[
        { value: "all", label: "All types", count: 42 },
        { value: "links", label: "Links", icon: <LinkIcon />, count: 18 },
        { value: "notes", label: "Notes", icon: <NoteIcon />, count: 15 },
        { value: "images", label: "Images", icon: <ImageIcon />, count: 9 },
      ]} />;
  },
  play: openMenu,
};

/** Field variant: a full-width form control paired with a visible label. */
export const Field: Story = {
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <label htmlFor="story-sort-field" className="grid w-72 gap-2 text-sm font-medium text-text-primary">
      Default sort
      <ShellTopMenu<Sort> {...args} id="story-sort-field" variant="field" className="ui-field min-h-11 px-3 text-sm font-normal" value={value} onChange={setValue} />
    </label>;
  },
};
