import type { Decorator, Preview } from "@storybook/nextjs-vite";
import { useLayoutEffect, type ReactNode } from "react";
import { MotionProvider } from "../src/components/ui/motion-provider";
import { motionCssVariables } from "../src/components/ui/motion-tokens";
import { THEMES, type ThemePreference } from "../src/app/theme-preference";
import { LANGUAGES, languageName, type Language } from "../src/i18n/locales";
import { LanguageOverrideContext } from "../src/i18n/use-translations";
import "@fontsource-variable/inter";
import "../src/app/globals.css";

type Theme = ThemePreference;
const THEME_ICONS: Partial<Record<Theme, string>> = { light: "sun", dark: "moon" };

/** Mirror the app root: data-theme and lang on <html>, canvas and text roles plus motion variables on <body>. */
function AppShell({ theme, language, children }: { theme: Theme; language: Language; children: ReactNode }) {
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = language;
    document.body.classList.add("bg-bg-canvas", "text-text-primary", "antialiased");
    for (const [name, value] of Object.entries(motionCssVariables)) {
      document.body.style.setProperty(name, String(value));
    }
  }, [theme, language]);
  return <LanguageOverrideContext value={language}><MotionProvider>{children}</MotionProvider></LanguageOverrideContext>;
}

const withAppShell: Decorator = (Story, context) => (
  <AppShell theme={(context.globals.theme ?? "light") as Theme} language={(context.globals.language ?? "en") as Language}>
    <Story />
  </AppShell>
);

const preview: Preview = {
  tags: ["autodocs"],
  globalTypes: {
    theme: {
      description: "Keepall color theme (sets data-theme on <html>)",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        // The same names as data-theme in the app and the Theme modes in Figma.
        items: THEMES.map((value) => ({ value, title: value[0].toUpperCase() + value.slice(1), icon: THEME_ICONS[value] ?? "paintbrush" })),
        dynamicTitle: true,
      },
    },
    language: {
      description: "Interface language. The pseudo-locale (en-XA) shows text that skipped src/i18n/messages and layouts too tight for longer translations.",
      toolbar: {
        title: "Language",
        icon: "globe",
        items: LANGUAGES.map((value) => ({ value, title: languageName(value) })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light", language: "en" },
  decorators: [withAppShell],
  parameters: {
    layout: "centered",
    controls: { expanded: true },
    // The canvas color comes from the theme tokens, not Storybook's backgrounds.
    backgrounds: { disable: true },
  },
};

export default preview;
