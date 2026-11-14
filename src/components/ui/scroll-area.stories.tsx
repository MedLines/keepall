import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ScrollArea, ScrollBar } from "./scroll-area";

const rows = Array.from({ length: 30 }, (_, index) => `Saved item ${index + 1} · notes.example`);

const meta = {
  title: "UI/ScrollArea",
  component: ScrollArea,
  subcomponents: { ScrollBar },
  args: { className: "h-64 w-72 rounded-panel border border-border-control bg-bg-surface" },
  argTypes: { orientation: { control: "inline-radio", options: ["vertical", "horizontal", "both"] } },
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

const List = () => (
  <ul className="flex flex-col gap-1 p-4 text-sm text-text-primary">
    {rows.map(row => <li key={row}>{row}</li>)}
  </ul>
);

const Wide = () => (
  <div className="flex w-[48rem] gap-3 p-4">
    {rows.slice(0, 12).map(row => (
      <div key={row} className="h-24 w-32 shrink-0 rounded-control-sm bg-bg-raised p-2 text-xs text-text-secondary">{row}</div>
    ))}
  </div>
);

export const Vertical: Story = { args: { orientation: "vertical", children: <List /> } };

/** scroll-fade goes on the viewport so the track stays usable. */
export const VerticalWithFade: Story = { args: { orientation: "vertical", viewportClassName: "scroll-fade", children: <List /> } };

export const Horizontal: Story = { args: { orientation: "horizontal", className: "h-36 w-96 rounded-panel border border-border-control bg-bg-surface", children: <Wide /> } };

export const Both: Story = {
  args: {
    orientation: "both",
    children: <div className="w-[40rem]"><List /></div>,
  },
};

/** Not scrollable: no track is shown. */
export const ShortContent: Story = { args: { children: <p className="p-4 text-sm text-text-primary">Fits without scrolling.</p> } };
