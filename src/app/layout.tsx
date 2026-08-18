import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Keepall",
  description: "A local-first personal library for links and notes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
