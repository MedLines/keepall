import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent } from "storybook/test";
import { ThemeControl } from "./theme-control";
import { THEME_STORAGE_KEY } from "./theme-preference";

/** ThemeControl reads the saved theme; the loader saves the toolbar's theme first so both agree. */
const meta = {
  title: "Shell/ThemeControl",
  component: ThemeControl,
  loaders: [async ({ globals }) => {
    try { localStorage.setItem(THEME_STORAGE_KEY, globals.theme === "dark" ? "dark" : "light"); } catch { /* storage blocked */ }
    return {};
  }],
} satisfies Meta<typeof ThemeControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Toolbar: Story = {};
export const Compact: Story = { args: { compact: true } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async () => {
    await userEvent.tab();
  },
};
