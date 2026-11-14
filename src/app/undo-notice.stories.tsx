import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn, userEvent } from "storybook/test";
import { Button } from "@/components/ui/button";
import { UndoNotice } from "./undo-notice";

const meta = {
  title: "Library/UndoNotice",
  component: UndoNotice,
  args: {
    message: "Moved “Tide table reminders” to Trash.",
    undoLabel: "Undo move of “Tide table reminders” to Trash",
    busy: false,
    paused: true,
    onUndo: fn(),
    onDismiss: fn(),
  },
  decorators: [(Story) => <div className="w-96"><Story /></div>],
} satisfies Meta<typeof UndoNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Paused so the countdown bar holds still. */
export const Paused: Story = {};

/** Live countdown: withdraws after 6s unless hovered, focused, busy or the tab is hidden. */
export const Countdown: Story = {
  args: { paused: false },
  render: function Render(args) {
    const [shown, setShown] = useState(true);
    return shown
      ? <UndoNotice {...args} onDismiss={() => { setShown(false); args.onDismiss(); }} />
      : <Button onClick={() => setShown(true)}>Show again</Button>;
  },
};

export const Busy: Story = { args: { busy: true } };
export const LongMessage: Story = { args: { message: "Moved “A collection of notes with a very long title that cannot fit” to Trash." } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async () => {
    await userEvent.tab();
  },
};
