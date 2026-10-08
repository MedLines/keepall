import { ScrollPanel } from "@/components/ui/scroll-panel";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, LogoIcon } from "../shell-icons";
import { LogoContextMenu } from "../logo-context-menu";
import { GeneralSettings, InstallationSettings, StorageSettings } from "./settings-sections";
import { SettingsTabs } from "./settings-tabs";
import { SettingsLink } from "./settings-link";

export const metadata: Metadata = {
  title: "Settings · Keepall",
};

export default function SettingsPage() {
  return (
    <ScrollPanel role="main" className="settings-page h-full min-h-0 bg-bg-shell" viewportClassName="p-2.5" contentClassName="!grid min-h-full">
      <div className="library-panel min-h-full bg-bg-canvas px-4 py-4 pb-24 sm:px-7 sm:pt-6 md:pb-6">
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <LogoContextMenu>
            <Link
              href="/"
              aria-label="Keepall home"
              className="keepall-logo-link flex min-h-11 items-center gap-0 rounded-control-lg px-2 text-text-primary"
            >
              <LogoIcon className="size-8" />
              <span className="text-lg font-medium">keepall</span>
            </Link>
          </LogoContextMenu>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/" aria-label="Back to library" className="ui-control inline-flex min-h-11 items-center gap-2 px-3 text-sm font-medium">
              <ArrowLeftIcon className="size-4" />
              <span className="hidden sm:inline">Back to library</span>
            </Link>
            <SettingsLink href="/about">About</SettingsLink>
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl">
          <div className="py-5 sm:py-6">
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-text-primary sm:text-3xl">
              Settings
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Appearance, storage, and installation.
            </p>
          </div>

          <SettingsTabs
            general={<GeneralSettings />}
            storage={<StorageSettings />}
            installation={<InstallationSettings />}
          />
          <nav aria-label="Support and information" className="mt-8 flex flex-wrap gap-2 border-t border-border-control pt-5">
            <SettingsLink href="/contact">Contact</SettingsLink>
            <SettingsLink href="/changelog">Changelog</SettingsLink>
            <SettingsLink href="/privacy">Privacy</SettingsLink>
          </nav>
        </div>
      </div>
    </ScrollPanel>
  );
}
