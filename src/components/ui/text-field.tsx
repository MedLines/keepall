import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Single-line .ui-field input: 44px, 12px padding, text-sm. */
export const FIELD_CLASS = "ui-field min-h-11 px-3 text-sm font-normal";

export function fieldClassName(className?: string) {
  return cn(FIELD_CLASS, className);
}

type Props = Omit<ComponentProps<"input">, "className"> & {
  /** Visible label; it is also the input's accessible name. */
  label: ReactNode;
  /** Helper text under the input, announced as its description. */
  hint?: ReactNode;
  className?: string;
  inputClassName?: string;
};

/** A labelled text input for dialogs and forms: label above (text-sm medium), 8px gap, optional hint. */
export function TextField({ label, hint, className, inputClassName, ...input }: Props) {
  const hintId = useId();
  return <label className={cn("grid gap-2 text-sm font-medium text-text-primary", className)}>
    {label}
    <input className={fieldClassName(inputClassName)} aria-describedby={hint ? hintId : undefined} {...input} />
    {hint ? <span id={hintId} className="text-sm font-normal text-text-secondary">{hint}</span> : null}
  </label>;
}
