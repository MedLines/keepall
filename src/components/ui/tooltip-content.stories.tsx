import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent } from "storybook/test";
import { MoreIcon } from "@/app/shell-icons";
import { iconButtonClassName } from "./button";
import { TooltipContent } from "./tooltip";

// TooltipContent supplies the portal, positioner and shared surface; the caller owns Root and Trigger.
const meta = {
  title: "UI/TooltipContent",
  component: TooltipContent,
  args: { children: "More actions" },
  argTypes: { side: { control: "inline-radio", options: ["top", "bottom", "left", "right"] }, children: { control: "text" } },
  render: (args) => (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger delay={0} className={iconButtonClassName()} aria-label="More actions"><MoreIcon /></BaseTooltip.Trigger>
      <TooltipContent {...args} />
    </BaseTooltip.Root>
  ),
  play: async () => {
    await userEvent.tab();
  },
} satisfies Meta<typeof TooltipContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Top: Story = { args: { side: "top" } };
export const Unstyled: Story = { args: { unstyled: true, className: "ui-popover p-3 text-sm text-text-primary", children: "Panel-style preview" } };
