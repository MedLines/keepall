"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "./shell-icons";
import {
  SHELL_TOP_BTN,
  SHELL_TOP_BTN_ACTIVE,
  SHELL_TOP_BTN_IDLE,
} from "./shell-styles";

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
  /** Emphasize trigger when a non-default value is active (e.g. type filter). */
  emphasized?: boolean;
};

export function ShellTopMenu<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
  iconOnly = false,
  emphasized = false,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const activeOption =
    options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={iconOnly ? `ui-control flex size-11 items-center justify-center rounded-control-lg ${emphasized ? "ui-selected" : ""}` : `${SHELL_TOP_BTN} ${emphasized ? SHELL_TOP_BTN_ACTIVE : SHELL_TOP_BTN_IDLE}`}
        aria-label={ariaLabel}
        title={`${ariaLabel}: ${activeOption?.label}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        {activeOption?.icon}
        {iconOnly ? (
          <span className="sr-only">{activeOption?.label}</span>
        ) : (
          <span>{activeOption?.label}</span>
        )}
        {!iconOnly ? <ChevronDownIcon className="text-text-secondary" /> : null}
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="ui-popover absolute right-0 top-[calc(100%+8px)] z-50 flex min-w-[11rem] flex-col gap-1 overflow-hidden"
        >
          {options.map((option) => (
            <li key={option.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={`ui-menu-item flex w-full items-center gap-2 text-left text-sm ${
                  option.value === value
                    ? "ui-selected font-medium"
                    : "text-text-primary"
                }`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.icon}
                {option.label}
                {option.count !== undefined ? (
                  <span className="ml-auto pl-3 text-xs tabular-nums text-text-secondary">
                    {option.count}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
