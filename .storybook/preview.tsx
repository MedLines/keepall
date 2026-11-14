import type { Decorator, Preview } from "@storybook/nextjs-vite";
import { useLayoutEffect, type ReactNode } from "react";
import { MotionProvider } from "../src/components/ui/motion-provider";
import { motionCssVariables } from "../src/components/ui/motion-tokens";
import { THEMES, type ThemePreference } from "../src/app/theme-preference";
import "@fontsource-variable/inter";
import "../src/app/globals.css";

type Theme = ThemePreference;
const THEME_ICONS: Partial<Record<Theme, string>> = { light: "sun", dark: "moon" };

/** Mirror the app root: data-theme on <html>, canvas and text roles plus motion variables on <body>. */
function AppShell({ theme, children }: { theme: Theme; children: ReactNode }) {
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.classList.add("bg-bg-canvas", "text-text-primary", "antialiased");
    for (const [name, value] of Object.entries(motionCssVariables)) {
      document.body.style.setProperty(name, String(value));
    }
  }, [theme]);
  return <MotionProvider>{children}</MotionProvider>;
}

const withAppShell: Decorator = (Story, context) => (
  <AppShell theme={(context.globals.theme ?? "light") as Theme}>
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
  },
  initialGlobals: { theme: "light" },
  decorators: [withAppShell],
  parameters: {
    layout: "centered",
    controls: { expanded: true },
    // The canvas color comes from the theme tokens, not Storybook's backgrounds.
    backgrounds: { disable: true },
  },
};

export default preview;
