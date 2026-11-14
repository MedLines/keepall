import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent } from "storybook/test";
import { TextField } from "./text-field";

/** TextField has no error prop; validation messages belong to the surrounding form. */
const meta = {
  title: "UI/TextField",
  component: TextField,
  args: { label: "Collection name", className: "w-80" },
  argTypes: { label: { control: "text" }, hint: { control: "text" } },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithValue: Story = { args: { defaultValue: "Weekend recipes" } };
export const WithPlaceholder: Story = { args: { placeholder: "e.g. Reading list" } };
export const WithHint: Story = { args: { hint: "Shown in the sidebar and on every card in the collection." } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async () => {
    await userEvent.tab();
  },
};
export const Disabled: Story = { args: { disabled: true, defaultValue: "Weekend recipes" } };
