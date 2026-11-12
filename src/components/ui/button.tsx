import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Visual role, layered on .ui-control (globals.css):
 * - secondary: bg-control surface, border-control hairline, text-secondary; hover bg-raised + text-primary.
 * - primary: .ui-primary. One per surface. White in the dark theme — never a mid-grey.
 * - danger: the confirm action of a destructive dialog.
 * - danger-ghost: a destructive entry point on a neutral surface, such as Empty Trash.
 */
export type ButtonVariant = "secondary" | "primary" | "danger" | "danger-ghost";

/**
 * Text button sizes:
 * - md: 40px, dialogs and panels.
 * - lg: 44px, page-level actions.
 * - toolbar: 44px library top bar. Padding stays with the caller because it depends on whether an icon leads.
 * - none: no size classes; the caller sets height, padding and type. For one-off controls only.
 */
export type ButtonSize = "md" | "lg" | "toolbar" | "none";

/** Icon button squares: sm 32px, md 40px (dialog close), lg 44px (top bar). */
export type IconButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  secondary: "ui-control",
  primary: "ui-control ui-primary",
  danger: "ui-control border-border-danger bg-bg-danger text-text-danger",
  "danger-ghost": "ui-control text-text-danger",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "min-h-10 px-4 text-sm font-medium",
  lg: "min-h-11 px-4 text-sm font-medium",
  toolbar: "h-11 shrink-0 gap-2 text-sm",
  none: "",
};

const ICON_SIZE_CLASSES: Record<IconButtonSize, string> = {
  sm: "size-8",
  md: "size-10",
  lg: "size-11",
};

const DISABLED = "disabled:opacity-(--opacity-disabled)";

type ButtonStyle = { variant?: ButtonVariant; size?: ButtonSize; className?: string };
type IconButtonStyle = { variant?: ButtonVariant; size?: IconButtonSize; className?: string };

/** Classes for elements that render their own button, such as Base UI triggers. */
export function buttonClassName({ variant = "secondary", size = "md", className }: ButtonStyle = {}) {
  return cn("inline-flex items-center justify-center", VARIANT_CLASSES[variant], SIZE_CLASSES[size], DISABLED, className);
}

/** Classes for icon-only elements that render their own button. Always pair with an aria-label. */
export function iconButtonClassName({ variant = "secondary", size = "md", className }: IconButtonStyle = {}) {
  return cn("flex shrink-0 items-center justify-center", VARIANT_CLASSES[variant], ICON_SIZE_CLASSES[size], DISABLED, className);
}

type ButtonProps = ComponentProps<"button"> & ButtonStyle;

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClassName({ variant, size, className })} {...props} />;
}

type IconButtonProps = ComponentProps<"button"> & IconButtonStyle & { "aria-label": string };

export function IconButton({ variant, size, className, type = "button", ...props }: IconButtonProps) {
  return <button type={type} className={iconButtonClassName({ variant, size, className })} {...props} />;
}
