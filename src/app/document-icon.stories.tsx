import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DocumentIcon } from "./document-icon";

const meta = {
  title: "Foundations/DocumentIcon",
  component: DocumentIcon,
  args: { format: "pdf", className: "item-type-icon--pdf size-5" },
  argTypes: { format: { control: "inline-radio", options: ["pdf", "text", "markdown"] } },
} satisfies Meta<typeof DocumentIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pdf: Story = {};
export const Text: Story = { args: { format: "text", className: "item-type-icon--text size-5" } };
export const Markdown: Story = { args: { format: "markdown", className: "item-type-icon--markdown size-5" } };
