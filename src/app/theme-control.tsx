"use client";

import { useSyncExternalStore } from "react";
import {
  getServerThemeSnapshot,
  getThemeSnapshot,
  setThemePreference,
  subscribeToTheme,
} from "./theme-preference";
import { DarkThemeIcon, LightThemeIcon } from "./shell-icons";

export function ThemeControl({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
  const dark = theme === "dark";

  return (
    <button
      type="button"
      aria-label="Theme"
      aria-pressed={dark}
      title={`Switch to ${dark ? "light" : "dark"} theme`}
      className={`theme-control flex h-11 items-center gap-2 rounded-xl text-text-secondary hover:bg-bg-raised ${compact ? "w-11 justify-center border border-border-edge" : "px-2"}`}
      onClick={() => setThemePreference(dark ? "light" : "dark")}
    >
      {dark ? <DarkThemeIcon /> : <LightThemeIcon />}
      <span className={compact ? "sr-only" : "text-sm"}>
        {dark ? "Dark" : "Light"} theme
      </span>
    </button>
  );
}
