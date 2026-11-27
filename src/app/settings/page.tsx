import type { Metadata } from "next";
import { SettingsPageContent } from "./settings-page-content";

export const metadata: Metadata = {
  title: "Settings · Keepall",
};

export default function SettingsPage() {
  return <SettingsPageContent />;
}
