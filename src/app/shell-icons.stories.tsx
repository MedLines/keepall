import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ComponentType } from "react";
import { DocumentIcon } from "./document-icon";
import * as shellIcons from "./shell-icons";

type IconComponent = ComponentType<{ className?: string }>;

const icons = Object.entries(shellIcons)
  .filter(([name]) => name.endsWith("Icon") && name !== "LogoIcon")
  .sort(([a], [b]) => a.localeCompare(b)) as [string, IconComponent][];

/**
 * The closed icon set. Import icons from `@/app/shell-icons` (Hugeicons glyphs at 18px, stroke 1.5,
 * aria-hidden) or `DocumentIcon` for file types. Never use emoji or another icon library.
 */
const meta = {
  title: "Foundations/Icons",
  component: shellIcons.LibraryIcon,
  subcomponents: { DocumentIcon, LogoIcon: shellIcons.LogoIcon },
  parameters: { layout: "padded" },
} satisfies Meta<typeof shellIcons.LibraryIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllIcons: Story = {
  render: () => (
    <ul className="grid grid-cols-4 gap-2 text-text-primary">
      {icons.map(([name, Icon]) => (
        <li key={name} className="flex items-center gap-3 rounded-control-sm bg-bg-surface px-3 py-2">
          <Icon />
          <code className="truncate text-xs text-text-secondary">{name}</code>
        </li>
      ))}
    </ul>
  ),
};

/** Size with className; the default is 18px. */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4 text-text-primary">
      <shellIcons.SearchIcon className="size-3" />
      <shellIcons.SearchIcon className="size-4" />
      <shellIcons.SearchIcon />
      <shellIcons.SearchIcon className="size-5" />
    </div>
  ),
};

export const DocumentIcons: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <DocumentIcon format="pdf" className="item-type-icon--pdf size-5" />
      <DocumentIcon format="text" className="item-type-icon--text size-5" />
      <DocumentIcon format="markdown" className="item-type-icon--markdown size-5" />
    </div>
  ),
};

export const Logo: Story = {
  render: () => <shellIcons.LogoIcon className="size-12" />,
};
