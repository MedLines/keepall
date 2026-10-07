"use client";

import { useId, useSyncExternalStore } from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import {
  getServerThemeSnapshot,
  getThemeSnapshot,
  setThemePreference,
  subscribeToTheme,
} from "./theme-preference";
import { DarkThemeIcon, LightThemeIcon } from "./shell-icons";
import { SHELL_TOOLTIP } from "./shell-styles";

export function ThemeControl({ compact = false }: { compact?: boolean }) {
  const tooltipId = useId();
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
  const dark = theme === "dark";

  return (
    <Tooltip.Root>
    <Tooltip.Trigger
      type="button"
      aria-label="Theme"
      aria-describedby={tooltipId}
      aria-pressed={dark}
      delay={350}
      className={`theme-control ui-control flex h-11 items-center gap-2 rounded-control-lg ${compact ? "w-11 justify-center" : "px-2"}`}
      onClick={() => setThemePreference(dark ? "light" : "dark")}
    >
      {dark ? <LightThemeIcon /> : <DarkThemeIcon />}
      <span className={compact ? "sr-only" : "text-sm"}>
        {dark ? "Dark" : "Light"} theme
      </span>
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Positioner side="bottom" sideOffset={8} className="z-[100]">
        <Tooltip.Popup id={tooltipId} role="tooltip" className={SHELL_TOOLTIP}>Switch to {dark ? "light" : "dark"} theme</Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
    </Tooltip.Root>
  );
}
