import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent } from "storybook/test";
import { DeleteIcon, EditIcon, MoreIcon, PinIcon } from "@/app/shell-icons";
import { IconButton } from "./button";
import { Tooltip, TooltipProvider } from "./tooltip";

/** Stories open the tooltip by moving keyboard focus onto the trigger. */
const openByFocus = async () => {
  await userEvent.tab();
};

const meta = {
  title: "UI/Tooltip",
  component: Tooltip,
  parameters: { layout: "centered" },
  args: {
    content: "More actions",
    delay: 0,
    children: <IconButton aria-label="More actions"><MoreIcon /></IconButton>,
  },
  argTypes: {
    side: { control: "inline-radio", options: ["top", "bottom", "left", "right"] },
    align: { control: "inline-radio", options: ["start", "center", "end"] },
    children: { control: false },
  },
  play: openByFocus,
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Top: Story = { args: { side: "top" } };
export const Right: Story = { args: { side: "right" } };
export const Left: Story = { args: { side: "left" } };
export const WithShortcut: Story = { args: { content: "Grid view · G" } };

/** describe={false} when the tooltip only repeats the accessible name. */
export const NotDescribing: Story = { args: { describe: false } };

/** A disabled tooltip never opens; the trigger keeps working. */
export const Disabled: Story = { args: { disabled: true } };

export const ExtraClasses: Story = { args: { className: "max-w-48", content: "Pinned items stay at the top of every view, even when you sort by oldest." } };

/** Content-only surface for triggers that compose their own Base UI root. */
export const Unstyled: Story = {
  args: {
    unstyled: true,
    className: "ui-popover p-3 text-sm text-text-primary",
    content: "Panel-style preview",
  },
};

/** A shared provider lets focus move between neighbours without waiting for the delay again. */
export const ProviderGroup: Story = {
  render: () => (
    <TooltipProvider delay={350}>
      <div className="flex gap-2">
        <Tooltip content="Edit"><IconButton aria-label="Edit"><EditIcon /></IconButton></Tooltip>
        <Tooltip content="Pin"><IconButton aria-label="Pin"><PinIcon /></IconButton></Tooltip>
        <Tooltip content="Delete"><IconButton aria-label="Delete" variant="danger-ghost"><DeleteIcon /></IconButton></Tooltip>
      </div>
    </TooltipProvider>
  ),
};
