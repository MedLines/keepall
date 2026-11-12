"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Select } from "@base-ui/react/select";
import { Tooltip } from "@base-ui/react/tooltip";
import { TooltipContent } from "@/components/ui/tooltip";
import { useId, type ReactNode } from "react";
import { MenuHoverList } from "@/components/ui/menu-hover-list";
import { CheckIcon, ChevronDownIcon } from "./shell-icons";
import {
  SHELL_TOP_BTN,
  SHELL_TOP_BTN_ACTIVE,
  SHELL_TOP_BTN_IDLE,
} from "./shell-styles";
import { iconButtonClassName } from "@/components/ui/button";
import { menuItemClassName } from "@/components/ui/menu-item";

type Option<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
  count?: number;
};

type Props<T extends string> = {
  ariaLabel: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  /** Trigger shows only the icon; dropdown options keep labels. */
  iconOnly?: boolean;
  triggerIcon?: ReactNode;
  /** Emphasize trigger when a non-default value is active (e.g. type filter). */
  emphasized?: boolean;
  showCheckmark?: boolean;
  className?: string;
  disabled?: boolean;
  portalContainer?: HTMLElement | null;
  /** Associate a visible <label htmlFor> with a full-width form field. */
  id?: string;
  variant?: "toolbar" | "field";
};

export function ShellTopMenu<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
  iconOnly = false,
  triggerIcon,
  emphasized = false,
  showCheckmark = true,
  className = "",
  disabled = false,
  portalContainer,
  id,
  variant = "toolbar",
}: Props<T>) {
  const tooltipId = useId();
  const field = variant === "field";
  const activeOption =
    options.find((option) => option.value === value) ?? options[0];

  const menu = (
    <Select.Root<T>
      disabled={disabled}
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue !== null) onChange(nextValue);
      }}
    >
      <Select.Trigger
        id={id}
        {...(field
          ? {}
          : { render: <Tooltip.Trigger delay={350} />, "aria-describedby": tooltipId })}
        className={
          field
            ? `flex w-full min-w-0 items-center justify-between gap-2 text-left ${className}`
            : `${iconOnly ? iconButtonClassName({ size: "lg", className: emphasized ? "ui-selected" : "" }) : `${SHELL_TOP_BTN} ${emphasized ? SHELL_TOP_BTN_ACTIVE : SHELL_TOP_BTN_IDLE}`} ${className}`
        }
        aria-label={field ? undefined : `${ariaLabel}: ${activeOption?.label ?? ""}`}
      >
        {triggerIcon ?? activeOption?.icon}
        {iconOnly ? (
          <span className="sr-only">{activeOption?.label}</span>
        ) : (
          <Select.Value>{activeOption?.label}</Select.Value>
        )}
        {!iconOnly ? <ChevronDownIcon className={field ? undefined : "text-text-secondary"} /> : null}
      </Select.Trigger>
      <Select.Portal container={portalContainer}>
        <Select.Positioner
          align={field ? "start" : "end"}
          alignItemWithTrigger={false}
          sideOffset={8}
          collisionPadding={8}
          positionMethod="fixed"
          className="z-[90] data-[anchor-hidden]:invisible"
        >
          <Select.Popup className="shell-select-popup ui-menu-popup ui-popover flex flex-col overflow-hidden max-h-[min(24rem,var(--available-height))] min-w-[max(9rem,var(--anchor-width))] max-w-[calc(100vw-1rem)] outline-none">
            <ScrollArea className="flex min-h-0 flex-col" viewportClassName="min-h-0 flex-1">
            <Select.List aria-label={ariaLabel}>
              <MenuHoverList>
                {options.map((option) => (
                  <Select.Item
                    key={option.value}
                    value={option.value}
                    label={option.label}
                    className={menuItemClassName({ className: `shell-select-option ${option.value === value ? "font-medium" : ""}` })}
                  >
                    {option.icon}
                    <Select.ItemText className="flex-1 whitespace-nowrap">{option.label}</Select.ItemText>
                    {option.count !== undefined ? (
                      <span className="pl-2 text-xs tabular-nums text-text-secondary">
                        {option.count}
                      </span>
                    ) : null}
                    {showCheckmark ? <span aria-hidden="true" className="inline-flex size-4 shrink-0 items-center justify-center">
                      {option.value === value ? <CheckIcon className="size-4" /> : null}
                    </span> : null}
                  </Select.Item>
                ))}
              </MenuHoverList>
            </Select.List>
            </ScrollArea>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );

  if (field) return menu;

  return (
    <Tooltip.Root>
      {menu}
      <TooltipContent id={tooltipId} container={portalContainer} collisionPadding={8}>{ariaLabel}: {activeOption?.label}</TooltipContent>
    </Tooltip.Root>
  );
}
