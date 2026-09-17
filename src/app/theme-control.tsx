"use client";

import { useSyncExternalStore } from "react";
import {
  getServerThemeSnapshot,
  getThemeSnapshot,
  setThemePreference,
  subscribeToTheme,
} from "./theme-preference";
import { ThemeIcon } from "./shell-icons";

export function ThemeControl({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);

  return (
    <label className={`theme-control relative flex h-10 items-center gap-2 rounded-control text-text-secondary hover:bg-bg-raised ${compact ? "mx-auto w-10 justify-center" : "px-2"}`}>
      <ThemeIcon />
      <span className={compact ? "sr-only" : "text-sm"}>Theme</span>
      <select
        aria-label="Theme"
        title="Theme"
        value={theme}
        onChange={(event) => setThemePreference(event.target.value)}
        className={compact ? "absolute inset-0 w-full cursor-pointer opacity-0" : "ml-auto min-w-0 cursor-pointer rounded-control bg-transparent py-1 text-sm text-text-primary"}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
