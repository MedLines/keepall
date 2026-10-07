import type { Metadata, Viewport } from "next";
import { oklchToHex } from "@/color-format.mjs";
import { Analytics } from "@vercel/analytics/next";
import { AutomaticBackupRunner } from "./automatic-backup-runner";
import { CaptureHost } from "./capture-host";
import { DevToolsEntry } from "./dev-tools-entry";
import { PwaProvider } from "./pwa-provider";
import { ItemNavigationHistory } from "./item-route-viewer";
import { THEME_INIT_SCRIPT } from "./theme-preference";
import { SHELL_INIT_SCRIPT } from "./shell-styles";
import { MotionProvider } from "@/components/ui/motion-provider";
import { motionCssVariables } from "@/components/ui/motion-tokens";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Keepall",
  title: "Keepall",
  description: "A local-first personal library for links and notes.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Keepall",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: oklchToHex("oklch(0.210330931 0.005860382 285.885132689)"),
};

export default function RootLayout({ children, viewer }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: SHELL_INIT_SCRIPT }} />
      </head>
      <body className="bg-bg-canvas text-text-primary antialiased" style={motionCssVariables}>
        <MotionProvider>
          <PwaProvider>
            <ItemNavigationHistory />
            <div id="route-content" className="contents">{children}</div>
            {viewer}
            <CaptureHost />
            <AutomaticBackupRunner />
          </PwaProvider>
          {process.env.NODE_ENV === "development" ? <DevToolsEntry /> : null}
          <Analytics />
        </MotionProvider>
      </body>
    </html>
  );
}
