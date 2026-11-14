import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { motion } from "motion/react";
import { MotionProvider } from "./motion-provider";
import { uiMotion } from "./motion-tokens";

// Not visual: the box below slides in, or appears in place when the OS asks for reduced motion.
const meta = {
  title: "UI/MotionProvider",
  component: MotionProvider,
  args: {
    children: (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={uiMotion.slow}
        className="rounded-panel border border-border-control bg-bg-surface p-4 text-sm text-text-primary"
      >
        Respects prefers-reduced-motion
      </motion.div>
    ),
  },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof MotionProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
