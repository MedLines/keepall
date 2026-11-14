import { Children, type ComponentProps } from "react";
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
 * - toolbar: 44px library top bar.
 * - none: no size classes; the caller sets height, padding and type. For one-off controls only.
 *
 * md, lg and toolbar add .ui-button: side padding comes from --button-px (16px; change it with
 * button-px-*, never px-*), and the side with an icon gets three quarters of it.
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
  md: "ui-button min-h-10 text-sm font-medium",
  lg: "ui-button min-h-11 text-sm font-medium",
  toolbar: "ui-button h-11 shrink-0 gap-2 text-sm",
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

/**
 * Text button for every action; pick the variant by role (one primary per surface, danger only to confirm a destructive dialog) and the size by placement.
 *
 * @import import { Button } from "@/components/ui/button";
 */
export function Button({ variant = "secondary", size = "md", className, type = "button", children, ...props }: ButtonProps) {
  // Bare text becomes a span so the icon-side padding rule can see which side the icon is on.
  const content = Children.map(children, (child) => (typeof child === "string" || typeof child === "number" ? <span>{child}</span> : child));
  return <button type={type} className={buttonClassName({ variant, size, className })} {...props}>{content}</button>;
}

type IconButtonProps = ComponentProps<"button"> & IconButtonStyle & { "aria-label": string };

/**
 * Square icon-only button for actions an icon alone makes clear (close, more, toolbar toggles); always give it an aria-label.
 *
 * @import import { IconButton } from "@/components/ui/button";
 */
export function IconButton({ variant = "secondary", size = "md", className, type = "button", ...props }: IconButtonProps) {
  return <button type={type} className={iconButtonClassName({ variant, size, className })} {...props} />;
}
