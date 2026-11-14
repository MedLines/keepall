import { Menu } from "@base-ui/react/menu";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useRef } from "react";
import { fn, userEvent, within } from "storybook/test";
import { IconButton } from "@/components/ui/button";
import { menuItemClassName } from "@/components/ui/menu-item";
import { DeleteIcon, EditIcon, MoreIcon, PinIcon } from "./shell-icons";
import { RowActionMenu } from "./row-action-menu";

const actions = () => <>
  <Menu.Item className={menuItemClassName()} onClick={fn()}><EditIcon />Edit</Menu.Item>
  <Menu.Item className={menuItemClassName()} onClick={fn()}><PinIcon />Pin to top</Menu.Item>
  <Menu.Item className={menuItemClassName({ tone: "danger" })} onClick={fn()}><DeleteIcon />Move to Trash</Menu.Item>
</>;

const meta = {
  title: "Shell/RowActionMenu",
  component: RowActionMenu,
  args: {
    label: "Actions for Tide table reminders",
    menu: actions,
    trigger: null,
    triggerRef: { current: null },
    children: () => <div />,
  },
  argTypes: { children: { control: false }, trigger: { control: false }, menu: { control: false } },
  render: function Render(args) {
    const triggerRef = useRef<HTMLButtonElement>(null);
    return <RowActionMenu {...args} triggerRef={triggerRef}
      trigger={<IconButton aria-label="More actions" size="sm"><MoreIcon /></IconButton>}>
      {(trigger) => (
        <div className="flex w-96 items-center justify-between gap-3 rounded-panel bg-bg-surface px-4 py-3 text-sm text-text-primary">
          <span>Tide table reminders</span>
          {trigger}
        </div>
      )}
    </RowActionMenu>;
  },
} satisfies Meta<typeof RowActionMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const OpenFromButton: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "More actions" }));
  },
};

/** Right-click anywhere on the row opens the same actions at the pointer. */
export const OpenByRightClick: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.pointer({ keys: "[MouseRight]", target: within(canvasElement).getByText("Tide table reminders") });
  },
};

export const Disabled: Story = { args: { disabled: true } };
