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
};

type Props<T extends string> = {
  ariaLabel: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  /** Trigger shows icon (+ chevron) only; dropdown options keep labels. */
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
        className={`${SHELL_TOP_BTN} ${emphasized ? SHELL_TOP_BTN_ACTIVE : SHELL_TOP_BTN_IDLE} ${iconOnly ? "px-2" : ""}`}
        aria-label={ariaLabel}
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
        <ChevronDownIcon className="text-zinc-400" />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[9rem] overflow-hidden rounded-[10px] border border-zinc-200/80 bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
        >
          {options.map((option) => (
            <li key={option.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  option.value === value
                    ? "bg-zinc-100 font-medium text-zinc-900"
                    : "text-zinc-700 hover:bg-zinc-50"
                }`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.icon}
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
