import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useRef } from "react";
import { fn } from "storybook/test";
import { ConfirmDialog } from "./confirm-dialog";

const meta = {
  title: "UI/ConfirmDialog",
  component: ConfirmDialog,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    title: "Delete “Field notes on tide pools”?",
    description: "This removes the note and its attachments from this device. You can’t undo this.",
    confirmLabel: "Delete forever",
    onConfirm: fn(),
    onOpenChange: fn(),
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDetails: Story = {
  args: {
    title: "Empty Trash?",
    description: "Everything in Trash is deleted from this device.",
    confirmLabel: "Empty Trash",
    children: <p className="text-sm text-text-secondary">12 items · 48 MB</p>,
  },
};

export const CustomCancelLabel: Story = { args: { cancelLabel: "Keep it" } };

/** Initial focus lands on Cancel when a cancelRef is passed. */
export const FocusOnCancel: Story = {
  render: function Render(args) {
    const cancelRef = useRef<HTMLButtonElement>(null);
    return <ConfirmDialog {...args} cancelRef={cancelRef} />;
  },
};

export const HoverConfirm: Story = {
  parameters: { pseudo: { hover: ["button.ui-control"], rootSelector: "body" } },
};

/** While busy the dialog can't be dismissed and both actions are disabled. */
export const Busy: Story = { args: { busy: true, pendingLabel: "Deleting…" } };

/** With onCancelWhileBusy, Cancel stays available while the work runs. */
export const BusyWithCancel: Story = { args: { busy: true, pendingLabel: "Deleting…", onCancelWhileBusy: fn() } };

export const CancelPending: Story = { args: { busy: true, onCancelWhileBusy: fn(), cancelPending: true } };

export const ErrorMessage: Story = { args: { error: "Couldn’t delete the item. Check storage and try again." } };
