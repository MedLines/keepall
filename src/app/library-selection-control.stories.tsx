import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn, userEvent } from "storybook/test";
import { LibrarySelectionControl } from "./library-selection-control";

/** The grid card's corner class, as used by LibraryItem. */
const CARD_CORNER = "library-card-media-chrome library-card-corner-control library-card-corner-start absolute z-20 flex items-center justify-center";

const meta = {
  title: "Library/LibrarySelectionControl",
  component: LibrarySelectionControl,
  parameters: { layout: "centered" },
  args: { label: "Select Rock pool at dusk", className: CARD_CORNER, visible: true, selected: false, disabled: false, onToggle: fn() },
  decorators: [(Story) => <div className="relative h-40 w-56 rounded-card bg-bg-raised"><Story /></div>],
  render: function Render(args) {
    const [selected, setSelected] = useState(args.selected);
    return <LibrarySelectionControl {...args} selected={selected} onToggle={() => { setSelected(!selected); args.onToggle(); }} />;
  },
} satisfies Meta<typeof LibrarySelectionControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const Selected: Story = { args: { selected: true } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async () => {
    await userEvent.tab();
  },
};
export const Disabled: Story = { args: { disabled: true } };

/** List rows hide the control until hover, focus or selection via data-visible. */
export const ListRowHidden: Story = {
  args: { visible: false, className: "library-list-select library-card-media-chrome absolute z-20 flex items-center justify-center" },
};
