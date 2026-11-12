"use client";

import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { useId, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared tooltip surface: radius-control-sm, bg-surface, border-control, text-xs medium, shadow-menu. */
export const TOOLTIP_CLASS =
  "rounded-control-sm border border-border-control bg-bg-surface px-2.5 py-1.5 text-xs font-medium text-text-primary shadow-menu transition-opacity duration-(--motion-quick) data-starting-style:opacity-0 data-ending-style:opacity-0";

type PositionerProps = ComponentProps<typeof BaseTooltip.Positioner>;

export type TooltipContentProps = {
  id?: string;
  children: ReactNode;
  side?: PositionerProps["side"];
  align?: PositionerProps["align"];
  sideOffset?: number;
  collisionPadding?: PositionerProps["collisionPadding"];
  container?: ComponentProps<typeof BaseTooltip.Portal>["container"];
  /** Stacking layer. Tooltips sit at z-100; previews anchored inside menus use z-90. */
  layerClassName?: string;
  /** Extra classes merged onto the shared surface. */
  className?: string;
  /** Replace the shared surface entirely, for panel-style previews. */
  unstyled?: boolean;
};

/** Portal, positioner and popup for a tooltip whose Root and Trigger are composed elsewhere (e.g. a Select trigger). */
export function TooltipContent({ id, children, side = "bottom", align, sideOffset = 8, collisionPadding, container, layerClassName = "z-[100]", className, unstyled = false }: TooltipContentProps) {
  return <BaseTooltip.Portal container={container}>
    <BaseTooltip.Positioner side={side} align={align} sideOffset={sideOffset} collisionPadding={collisionPadding} className={layerClassName}>
      <BaseTooltip.Popup id={id} role="tooltip" className={unstyled ? className : cn(TOOLTIP_CLASS, className)}>{children}</BaseTooltip.Popup>
    </BaseTooltip.Positioner>
  </BaseTooltip.Portal>;
}

export type TooltipProps = Omit<TooltipContentProps, "id" | "children"> & {
  /** Tooltip text or content. */
  content: ReactNode;
  /** The trigger element; its props, ref and handlers are kept. */
  children: ReactElement;
  /** Open delay in ms. Toolbar controls use 350; folder and tag previews 100. */
  delay?: number;
  closeDelay?: number;
  disabled?: boolean;
  /** Link the trigger to the tooltip with aria-describedby. */
  describe?: boolean;
};

/** A styled Base UI tooltip around any trigger element. Never use a native title attribute alongside it. */
export function Tooltip({ content, children, delay = 350, closeDelay, disabled, describe = true, ...contentProps }: TooltipProps) {
  const id = useId();
  return <BaseTooltip.Root disabled={disabled}>
    <BaseTooltip.Trigger render={children} delay={delay} closeDelay={closeDelay} aria-describedby={describe && !disabled ? id : undefined} />
    <TooltipContent id={id} {...contentProps}>{content}</TooltipContent>
  </BaseTooltip.Root>;
}

export const TooltipProvider = BaseTooltip.Provider;
