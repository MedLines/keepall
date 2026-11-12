import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The control surface used for a selectable radio option; checked options take bg-active. */
export const RADIO_CARD_CLASS = "ui-control flex cursor-pointer items-start gap-3 px-4 py-3 text-sm has-[:checked]:bg-bg-active";

type Props = Omit<ComponentProps<"input">, "type" | "className" | "children"> & {
  /** Extra classes for the label surface. */
  className?: string;
  /** Classes for the radio itself; nudge it to the first line of the label text. */
  inputClassName?: string;
  /** Label and description shown beside the radio. */
  children: ReactNode;
};

/** A full-width radio option: the whole card is the label, so the text is the radio's accessible name. */
export function RadioCard({ className, inputClassName = "mt-1", children, ...input }: Props) {
  return <label className={cn(RADIO_CARD_CLASS, className)}>
    <input type="radio" className={inputClassName} {...input} />
    {children}
  </label>;
}
