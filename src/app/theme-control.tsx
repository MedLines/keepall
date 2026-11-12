"use client";

import { useSyncExternalStore } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import {
  getServerThemeSnapshot,
  getThemeSnapshot,
  setThemePreference,
  subscribeToTheme,
} from "./theme-preference";
import { DarkThemeIcon, LightThemeIcon } from "./shell-icons";
import { buttonClassName, iconButtonClassName } from "@/components/ui/button";

export function ThemeControl({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
  const dark = theme === "dark";

  return (
    <Tooltip content={`Switch to ${dark ? "light" : "dark"} theme`}>
      <button
        type="button"
        aria-label="Theme"
        aria-pressed={dark}
        className={compact ? iconButtonClassName({ size: "lg", className: "theme-control gap-2" }) : buttonClassName({ size: "toolbar", className: "theme-control px-2" })}
        onClick={() => setThemePreference(dark ? "light" : "dark")}
      >
        {dark ? <LightThemeIcon /> : <DarkThemeIcon />}
        <span className={compact ? "sr-only" : "text-sm"}>
          {dark ? "Dark" : "Light"} theme
        </span>
      </button>
    </Tooltip>
  );
}
