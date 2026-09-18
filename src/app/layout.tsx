import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { CaptureHost } from "./capture-host";
import { DevToolsEntry } from "./dev-tools-entry";
import { PwaProvider } from "./pwa-provider";
import { THEME_INIT_SCRIPT } from "./theme-preference";
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
  themeColor: "#18181b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-bg-canvas text-text-primary antialiased">
        <PwaProvider>
          {children}
          <CaptureHost />
        </PwaProvider>
        {process.env.NODE_ENV === "development" ? <DevToolsEntry /> : null}
        <Analytics />
      </body>
    </html>
  );
}
