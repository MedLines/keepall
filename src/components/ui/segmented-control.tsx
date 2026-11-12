"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipProvider, type TooltipContentProps } from "./tooltip";

type Choice<Value extends string> = {
  value: Value;
  /** Visible text for the text variant. Icon-only choices leave it out and set ariaLabel. */
  label?: ReactNode;
  ariaLabel?: string;
  icon?: ReactNode;
  tooltip?: ReactNode;
};

type Props<Value extends string> = Omit<ComponentProps<"div">, "onChange" | "children"> & {
  /** Accessible name of the group. */
  label: string;
  value: Value;
  choices: readonly [Choice<Value>, Choice<Value>];
  onChange: (value: Value) => void;
  /**
   * - icon: 44px track with two 42px icon buttons (library layout, note edit/preview).
   * - text: flexible track whose height follows --viewer-control-size (viewers, note format, gallery mode).
   */
  variant?: "icon" | "text";
  disabled?: boolean;
  thumbClassName?: string;
  tooltipSide?: TooltipContentProps["side"];
  tooltipContainer?: TooltipContentProps["container"];
};

const TRACK = {
  icon: "h-11",
  text: "h-[var(--viewer-control-size,2.75rem)]",
};
const THUMB = {
  icon: "h-10 w-[42px]",
  text: "h-[calc(var(--viewer-control-size,2.75rem)_-_0.25rem)] w-[calc(50%_-_2px)]",
};
const OPTION = {
  icon: "size-10 w-[42px]",
  text: "h-[calc(var(--viewer-control-size,2.75rem)_-_0.25rem)] min-w-0 flex-1 gap-1.5 px-2 text-xs font-medium",
};

/**
 * Two-choice segmented switch (.icon-segmented-switch). The .ui-selected thumb slides between the
 * choices over --motion-glide; the group is labelled and each choice reports aria-pressed.
 */
export function SegmentedControl<Value extends string>({
  label, value, choices, onChange, variant = "text", disabled = false, className, thumbClassName, tooltipSide = "bottom", tooltipContainer, ...groupProps
}: Props<Value>) {
  const options = choices.map(choice => {
    const selected = value === choice.value;
    const button = <button key={choice.value} type="button" aria-label={choice.ariaLabel} aria-pressed={selected} disabled={disabled}
      className={cn("relative flex items-center justify-center disabled:opacity-(--opacity-disabled)", OPTION[variant], selected ? "text-text-primary" : "text-text-secondary hover:text-text-primary")}
      onClick={() => onChange(choice.value)}>
      {choice.icon}{choice.label}
    </button>;
    return choice.tooltip ? <Tooltip key={choice.value} content={choice.tooltip} side={tooltipSide} container={tooltipContainer}>{button}</Tooltip> : button;
  });
  const group = <div role="group" aria-label={label} data-selected={value === choices[1].value ? "end" : "start"} {...groupProps}
    className={cn("icon-segmented-switch relative isolate flex shrink-0 bg-bg-raised p-0.5", TRACK[variant], className)}>
    <span aria-hidden="true" className={cn("icon-segmented-thumb ui-selected pointer-events-none absolute left-0.5 top-0.5", THUMB[variant], thumbClassName)} />
    {options}
  </div>;
  return choices.some(choice => choice.tooltip) ? <TooltipProvider delay={350}>{group}</TooltipProvider> : group;
}
