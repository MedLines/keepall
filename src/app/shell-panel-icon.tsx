"use client";

import { motion, useReducedMotion } from "motion/react";
import { PanelIcon } from "./shell-icons";

type Props = {
  open: boolean;
  className?: string;
};

export function ShellPanelIcon({ open, className }: Props) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <PanelIcon className={className} />;
  }

  return (
    <span className={`relative block size-5 shrink-0 ${className ?? ""}`}>
      <motion.span
        initial={false}
        animate={{
          opacity: open ? 1 : 0,
          scale: open ? 1 : 0.25,
          filter: open ? "blur(0px)" : "blur(4px)",
        }}
        transition={{ type: "spring", duration: 0.3, bounce: 0 }}
        className="absolute inset-0 flex items-center justify-center"
        aria-hidden={!open}
      >
        <PanelIcon />
      </motion.span>
      <motion.span
        initial={false}
        animate={{
          opacity: open ? 0 : 1,
          scale: open ? 0.25 : 1,
          filter: open ? "blur(4px)" : "blur(0px)",
        }}
        transition={{ type: "spring", duration: 0.3, bounce: 0 }}
        className="absolute inset-0 flex items-center justify-center"
        aria-hidden={open}
      >
        <PanelCollapsedIcon />
      </motion.span>
    </span>
  );
}

function PanelCollapsedIcon() {
  return (
    <svg
      className="size-5 shrink-0"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      <rect
        x="3"
        y="4"
        width="5"
        height="12"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M11 10h6M13 7.5 15.5 10 13 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
