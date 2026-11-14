import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent } from "storybook/test";
import { SettingsLink } from "./settings-link";

const meta = {
  title: "Shell/SettingsLink",
  component: SettingsLink,
  args: { href: "#backup", children: "Back up your library" },
  argTypes: { children: { control: "text" } },
  decorators: [(Story) => <div className="grid w-80"><Story /></div>],
} satisfies Meta<typeof SettingsLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Secondary: Story = {};
export const Primary: Story = { args: { primary: true } };
/** Hrefs that don't start with # use next/link. */
export const PageLink: Story = { args: { href: "/help", children: "Open Help" } };
export const Hover: Story = {
  render: (args) => <div className="grid gap-2"><SettingsLink {...args} /><SettingsLink {...args} primary /></div>,
  parameters: { pseudo: { hover: true } },
};
export const Focus: Story = {
  play: async () => {
    await userEvent.tab();
  },
};
