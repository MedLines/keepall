import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";
import { Button } from "./button";
import { Toaster, toast } from "./toaster";

// The Toaster is mounted once at the app root; call toast() from anywhere.
const meta = {
  title: "UI/Toaster",
  component: Toaster,
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="flex min-h-96 items-start gap-2 p-6">
      <Button onClick={() => toast("Saved to Keepall")}>Plain</Button>
      <Button onClick={() => toast.success("Backup downloaded")}>Success</Button>
      <Button onClick={() => toast.error("Couldn’t reach notes.example")}>Error</Button>
      <Toaster />
    </div>
  ),
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Plain" }));
  },
};

export const Success: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Success" }));
  },
};

export const ErrorToast: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Error" }));
  },
};
