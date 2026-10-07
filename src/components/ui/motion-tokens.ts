import type { CSSProperties } from "react";

export const uiMotion = {
  fast: { type: "spring", duration: 0.08, bounce: 0, exit: { duration: 0.06 } },
  moderate: { type: "spring", duration: 0.16, bounce: 0, exit: { duration: 0.12 } },
  slow: { type: "spring", duration: 0.24, bounce: 0.12, exit: { duration: 0.16 } },
} as const;

export const motionCssVariables = Object.fromEntries(
  Object.entries(uiMotion).flatMap(([tier, transition]) => [
    [`--motion-${tier}-enter`, `${transition.duration * 1000}ms`],
    [`--motion-${tier}-exit`, `${transition.exit.duration * 1000}ms`],
  ]),
) as CSSProperties;
