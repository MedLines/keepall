import { Menu } from "@base-ui/react/menu";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent } from "storybook/test";
import { CopyIcon, DeleteIcon, EditIcon, MoreIcon, PinIcon } from "@/app/shell-icons";
import { iconButtonClassName } from "./button";
import { MenuHoverList } from "./menu-hover-list";
import { menuItemClassName } from "./menu-item";

// MenuHoverList inside a Base UI menu whose items use menuItemClassName().
// Tones: default and danger. Disabled items keep the default tone.
const meta = {
  title: "UI/MenuHoverList",
  component: MenuHoverList,
  parameters: { layout: "centered" },
  args: { children: null },
  argTypes: { children: { control: false } },
  render: () => (
    <Menu.Root defaultOpen modal={false}>
      <Menu.Trigger className={iconButtonClassName()} aria-label="Item actions"><MoreIcon /></Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={8} className="z-[90]">
          <Menu.Popup className="ui-menu-popup ui-popover min-w-48 outline-none">
            <MenuHoverList>
              <Menu.Item className={menuItemClassName()}><EditIcon />Edit</Menu.Item>
              <Menu.Item className={menuItemClassName()}><PinIcon />Pin to top</Menu.Item>
              <Menu.Item className={menuItemClassName()} disabled><CopyIcon />Copy link</Menu.Item>
              <Menu.Item className={menuItemClassName({ layout: "none", className: "grid gap-0.5" })}>
                <span>Recently added</span>
                <span className="text-xs text-text-secondary">Layout “none”: the caller arranges the row</span>
              </Menu.Item>
              <Menu.Item className={menuItemClassName({ tone: "danger" })}><DeleteIcon />Move to Trash</Menu.Item>
            </MenuHoverList>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  ),
} satisfies Meta<typeof MenuHoverList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Keyboard highlight: the gliding highlight follows Arrow keys. */
export const KeyboardHighlight: Story = {
  play: async () => {
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
  },
};

export const HoverRow: Story = {
  parameters: { pseudo: { hover: [".ui-menu-item:first-of-type"], rootSelector: "body" } },
};
