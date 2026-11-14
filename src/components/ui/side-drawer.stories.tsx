import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { SideDrawer } from "./side-drawer";
import { TextField } from "./text-field";

const meta = {
  title: "UI/SideDrawer",
  component: SideDrawer,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onOpenChange: fn(),
    title: "Add to Keepall",
    description: "Save a link, note or file to this device.",
    children: (
      <div className="flex flex-col gap-4 px-7 pb-6">
        <TextField label="Link" defaultValue="https://tidepools.example/guide" />
        <TextField label="Title" defaultValue="A beginner’s guide to tide pools" />
      </div>
    ),
  },
  argTypes: {
    side: { control: "inline-radio", options: ["left", "right"] },
    children: { control: false },
  },
} satisfies Meta<typeof SideDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Right: Story = { args: { side: "right" } };
export const Left: Story = { args: { side: "left", title: "Organize", description: "Move items between collections." } };
export const WithoutDescription: Story = { args: { description: undefined } };
export const CloseDisabled: Story = { args: { closeDisabled: true } };
export const CustomWidth: Story = { args: { widthClassName: "w-[min(40rem,100vw)]" } };
