import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent } from "storybook/test";
import { CardNote, CardPin, CardSource } from "./library-card-details";

/** Card footer rows: source host, attached note and pin. Shown inside a card-width surface. */
const meta = {
  title: "Library/CardSource",
  component: CardSource,
  subcomponents: { CardNote, CardPin },
  args: { url: "https://tidepools.example/guide" },
  decorators: [(Story) => <div className="library-card grid w-80 gap-1.5 rounded-panel p-4 text-meta text-text-secondary"><Story /></div>],
} satisfies Meta<typeof CardSource>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Source: Story = {};
export const SourceWithoutFavicon: Story = { args: { showFavicon: false } };
export const SourceSearchMatch: Story = { args: { query: "tidepools" } };
/** Older imports can store a raw label instead of a URL. */
export const SourceRawLabel: Story = { args: { url: "Saved from a shared folder" } };
export const SourceHover: Story = { parameters: { pseudo: { hover: true } } };
export const SourceFocus: Story = {
  play: async () => {
    await userEvent.tab();
  },
};

const note = "Read the section on anemones before Saturday, and bring the tide table.";

export const Note: Story = {
  render: () => <CardNote content={note} title="A beginner’s guide to tide pools" onOpen={fn()} />,
};
export const MarkdownNote: Story = {
  render: () => <CardNote content={"**Bring:** boots, torch"} format="markdown" title="Packing list" onOpen={fn()} />,
};
export const NoteAsLink: Story = {
  render: () => <CardNote content={note} title="A beginner’s guide to tide pools" openHref="/items/link-1" onOpen={fn()} />,
};
export const NoteReadOnly: Story = {
  render: () => <CardNote content={note} title="A beginner’s guide to tide pools" readOnly onOpen={fn()} />,
};
export const NoteSearchMatch: Story = {
  render: () => <CardNote content={note} title="A beginner’s guide to tide pools" query="anemones" onOpen={fn()} />,
};
/** Icon-only notes (list rows) show the excerpt in a tooltip on hover or focus. */
export const NoteIconOnly: Story = {
  render: () => <CardNote content={note} title="A beginner’s guide to tide pools" iconOnly onOpen={fn()} />,
  play: async () => {
    await userEvent.tab();
  },
};
/** Renders nothing when there is no note content. */
export const NoteEmpty: Story = {
  render: () => <CardNote content="  " title="Untitled" onOpen={fn()} />,
};

export const Pin: Story = { render: () => <CardPin /> };
