import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { MediaViewerToolbar } from "./media-viewer-toolbar";
import { ArrowLeftIcon, ArrowRightIcon } from "./shell-icons";

function ImageSizing() {
  const [value, setValue] = useState<"fit" | "scroll">("fit");
  return <SegmentedControl label="Image sizing" value={value} onChange={setValue} className="w-40"
    choices={[{ value: "fit", label: "Fit", ariaLabel: "Fit image" }, { value: "scroll", label: "Scroll", ariaLabel: "Scroll image" }]} />;
}

function Pager({ count = 4 }: { count?: number }) {
  const [index, setIndex] = useState(0);
  return <div className="flex items-center justify-center gap-1.5">
    <IconButton aria-label="Previous image" disabled={index === 0} onClick={() => setIndex(index - 1)}><ArrowLeftIcon className="size-4" /></IconButton>
    <span className="whitespace-nowrap text-xs tabular-nums text-text-secondary"><span className="sr-only">Image </span>{index + 1} of {count}</span>
    <IconButton aria-label="Next image" disabled={index >= count - 1} onClick={() => setIndex(index + 1)}><ArrowRightIcon className="size-4" /></IconButton>
  </div>;
}

// View choices left, navigation center, zoom right; Scroll is always the last view choice.
const meta = {
  title: "Library/MediaViewerToolbar",
  component: MediaViewerToolbar,
  parameters: { layout: "fullscreen" },
  args: { view: <ImageSizing />, navigation: <Pager />, zoom: <Button>100%</Button> },
  argTypes: { view: { control: false }, navigation: { control: false }, zoom: { control: false } },
  decorators: [(Story) => <div className="media-viewer-frame bg-bg-canvas p-4"><Story /></div>],
} satisfies Meta<typeof MediaViewerToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ImageGallery: Story = {};
export const SingleImage: Story = { args: { navigation: null } };
export const WithoutZoom: Story = { args: { zoom: undefined } };
/** PDF toolbars dim enabled controls until the document is ready. */
export const Pdf: Story = { args: { pdf: true } };
/** Narrow widths move navigation to its own row. */
export const Narrow: Story = { decorators: [(Story) => <div className="w-80"><Story /></div>] };
