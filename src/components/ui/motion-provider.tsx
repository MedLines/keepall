"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/** DRAFT: App-root provider that makes Motion animations follow the system reduced-motion setting; mount it once. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
