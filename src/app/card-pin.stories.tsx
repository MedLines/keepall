import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CardPin } from "./library-card-details";

const meta = {
  title: "Library/CardPin",
  component: CardPin,
} satisfies Meta<typeof CardPin>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
