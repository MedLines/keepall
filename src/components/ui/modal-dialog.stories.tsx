import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { Button } from "./button";
import { ModalDialog } from "./modal-dialog";
import { TextField } from "./text-field";

const meta = {
  title: "UI/ModalDialog",
  component: ModalDialog,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onOpenChange: fn(),
    title: "Rename collection",
    description: "Collections group items you want to find together.",
    footer: <><Button>Cancel</Button><Button variant="primary" type="submit">Save</Button></>,
    children: <TextField label="Name" defaultValue="Weekend recipes" />,
  },
  argTypes: {
    size: { control: "inline-radio", options: ["compact", "editor"] },
    children: { control: false },
    footer: { control: false },
  },
} satisfies Meta<typeof ModalDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Compact: Story = { args: { size: "compact" } };

/** onSubmit wraps the body and footer in a form; Ctrl/Cmd+Enter submits. */
export const WithForm: Story = { args: { onSubmit: fn() } };

export const Editor: Story = {
  args: {
    size: "editor",
    title: "Edit note",
    description: "Changes save to this device.",
    children: Array.from({ length: 24 }, (_, index) => (
      <p key={index} className="text-sm text-text-primary">Paragraph {index + 1}. A short invented line of text that makes the body long enough to scroll.</p>
    )),
  },
};

export const FooterOnly: Story = {
  args: { title: "Export library", description: "Download a backup file of everything on this device.", children: undefined },
};

export const Busy: Story = {
  args: { busy: true, footer: <><Button disabled>Cancel</Button><Button variant="primary" disabled>Saving…</Button></> },
};

export const CustomCloseLabel: Story = { args: { closeLabel: "Close rename dialog" } };
