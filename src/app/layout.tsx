import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { CaptureHost } from "./capture-host";
import { PwaProvider } from "./pwa-provider";
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
    <html lang="en">
      <body className="bg-zinc-50 text-zinc-950 antialiased">
        <PwaProvider>
          {children}
          <CaptureHost />
        </PwaProvider>
        <Analytics />
      </body>
    </html>
  );
}
