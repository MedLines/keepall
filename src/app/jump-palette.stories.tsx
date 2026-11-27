import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn, userEvent, within } from "storybook/test";
import type { Collection } from "@/domain/collection";
import { buildNote } from "@/domain/note";
import type { Tag } from "@/domain/tag";
import { JumpPalette, type JumpFilter } from "./jump-palette";

const collectionNames = ["Design inspiration", "Reading list", "Recipes", "Launch notes", "Typography", "Travel plans", "Home office", "Research papers"];
const collections: Collection[] = collectionNames.map((name, index) => ({ id: `c${index}`, name, createdAt: index + 1, pinnedItemIds: [] }));
const tagNames = ["animation", "colour", "css", "fonts", "layout", "motion", "react", "typography"];
const tags: Tag[] = tagNames.map((name, index) => ({ id: `t${index}`, name, createdAt: index + 1 }));
const collectionCounts = Object.fromEntries(collections.map((collection, index) => [collection.id, 4 + index * 7]));
const tagCounts = Object.fromEntries(tags.map((tag, index) => [tag.id, 30 - index * 3]));
const recent = ["Variable fonts in practice", "Spring physics primer", "Grid layout cheatsheet", "Writing better errors"]
  .map((content, index) => buildNote({ content }, { id: `n${index}`, now: 10 - index }));

const meta = {
  title: "Shell/JumpPalette",
  component: JumpPalette,
  args: {
    open: true, onOpenChange: fn(), filter: "all", onFilterChange: fn(),
    collections, tags, pinnedCollectionIds: ["c3", "c0"], collectionCounts, tagCounts, mutationBusy: false,
    recentItems: () => recent,
    onGoCollection: fn(), onGoTag: fn(), onGoCollections: fn(), onGoTags: fn(),
    onTogglePinnedCollection: fn(), onRenameCollection: fn(), onDeleteCollection: fn(), onDeleteTag: fn(),
  },
  render: function Render(args) {
    const [filter, setFilter] = useState<JumpFilter>(args.filter);
    return <JumpPalette {...args} filter={filter} onFilterChange={next => { setFilter(next); args.onFilterChange(next); }} />;
  },
} satisfies Meta<typeof JumpPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pinned collections first, then the most used tags. */
export const All: Story = {};
/** Opened from the sidebar's Collections row. */
export const Collections: Story = { args: { filter: "collections" } };
/** Opened from the sidebar's Tags row: every tag, A to Z. */
export const Tags: Story = { args: { filter: "tags" } };
export const Searching: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(within(canvasElement.ownerDocument.body).getByRole("combobox"), "ty");
  },
};
export const NoMatches: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(within(canvasElement.ownerDocument.body).getByRole("combobox"), "zzz");
  },
};
export const Empty: Story = { args: { collections: [], tags: [], pinnedCollectionIds: [] } };
export const Busy: Story = { args: { mutationBusy: true } };
