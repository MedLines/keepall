"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * App-root provider that makes Motion animations follow the system reduced-motion setting; mount it once.
 *
 * @import import { MotionProvider } from "@/components/ui/motion-provider";
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
