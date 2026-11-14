import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent } from "storybook/test";
import { ScrollTextarea } from "./scroll-textarea";

const longText = Array.from({ length: 18 }, (_, index) => `Line ${index + 1}: an invented note about tide tables and low-water walks.`).join("\n");

const meta = {
  title: "UI/ScrollTextarea",
  component: ScrollTextarea,
  args: {
    "aria-label": "Note",
    className: "ui-field h-48 w-96 px-3 py-3 text-sm",
    defaultValue: longText,
  },
} satisfies Meta<typeof ScrollTextarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { defaultValue: undefined, placeholder: "Write a note…" } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async () => {
    await userEvent.tab();
  },
};
export const Disabled: Story = { args: { disabled: true } };
