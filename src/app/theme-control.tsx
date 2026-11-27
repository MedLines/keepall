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
import { useTranslations } from "@/i18n/use-translations";

/**
 * Toggle between the light and dark theme; saves the choice on this device.
 *
 * @import import { ThemeControl } from "@/app/theme-control";
 */
export function ThemeControl({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
  const dark = theme === "dark";
  const t = useTranslations("ThemeControl");

  return (
    <Tooltip content={t(dark ? "switchToLight" : "switchToDark")}>
      <button
        type="button"
        aria-label={t("label")}
        aria-pressed={dark}
        className={compact ? iconButtonClassName({ size: "lg", className: "theme-control gap-2" }) : buttonClassName({ size: "toolbar", className: "theme-control button-px-2" })}
        onClick={() => setThemePreference(dark ? "light" : "dark")}
      >
        {dark ? <LightThemeIcon /> : <DarkThemeIcon />}
        <span className={compact ? "sr-only" : "text-sm"}>{t(dark ? "dark" : "light")}</span>
      </button>
    </Tooltip>
  );
}
