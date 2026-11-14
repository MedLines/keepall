import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ScrollPanel } from "./scroll-panel";

const rows = Array.from({ length: 30 }, (_, index) => `Page ${index + 1} of an invented field guide`);

const meta = {
  title: "UI/ScrollPanel",
  component: ScrollPanel,
  args: {
    className: "h-64 w-72 rounded-panel border border-border-control bg-bg-surface",
    contentClassName: "flex flex-col gap-1 p-4 text-sm text-text-primary",
    viewportProps: { "data-document-scroll": true },
    children: rows.map(row => <p key={row}>{row}</p>),
  },
  argTypes: {
    orientation: { control: "inline-radio", options: ["vertical", "horizontal", "both"] },
    children: { control: false },
  },
} satisfies Meta<typeof ScrollPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Vertical: Story = { args: { orientation: "vertical" } };
export const Horizontal: Story = {
  args: {
    orientation: "horizontal",
    className: "h-36 w-96 rounded-panel border border-border-control bg-bg-surface",
    contentClassName: "flex w-[48rem] gap-3 p-4 text-xs text-text-secondary",
    children: rows.slice(0, 10).map(row => <div key={row} className="h-20 w-32 shrink-0 rounded-control-sm bg-bg-raised p-2">{row}</div>),
  },
};
export const Both: Story = {
  args: {
    orientation: "both",
    contentClassName: "w-[36rem] p-4 text-sm text-text-primary",
  },
};
export const WithFade: Story = { args: { viewportClassName: "scroll-fade" } };
