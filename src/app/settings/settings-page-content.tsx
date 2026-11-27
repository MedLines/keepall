"use client";

import { ScrollPanel } from "@/components/ui/scroll-panel";
import Link from "next/link";
import { ArrowLeftIcon, LogoIcon } from "../shell-icons";
import { LogoContextMenu } from "../logo-context-menu";
import { GeneralSettings, InstallationSettings, StorageSettings } from "./settings-sections";
import { SettingsTabs } from "./settings-tabs";
import { AgentsSettings } from "./agents-settings";
import { SettingsLink } from "./settings-link";
import { buttonClassName } from "@/components/ui/button";
import { useTranslations } from "@/i18n/use-translations";

/** The Settings page body. A client component so its text follows the interface language. */
export function SettingsPageContent() {
  const t = useTranslations("SettingsPage");
  return (
    <ScrollPanel role="main" className="h-full min-h-0 bg-bg-shell" viewportClassName="p-2.5" contentClassName="!grid min-h-full">
      <div className="library-panel min-h-full bg-bg-canvas px-4 py-4 pb-24 sm:px-7 sm:pt-6 md:pb-6">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <LogoContextMenu>
            <Link
              href="/"
              aria-label={t("homeLabel")}
              className="keepall-logo-link flex min-h-11 items-center gap-0 rounded-control-lg px-2 text-text-primary"
            >
              <LogoIcon className="size-8" />
              {/* The wordmark is the product name, the same in every language. */}
              {/* eslint-disable-next-line react/jsx-no-literals */}
              <span className="text-lg font-medium">keepall</span>
            </Link>
          </LogoContextMenu>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/" aria-label={t("backToLibrary")} className={buttonClassName({ size: "none", className: "min-h-11 gap-2 px-3 text-sm font-medium justify-start" })}>
              <ArrowLeftIcon className="size-4" />
              <span className="hidden sm:inline">{t("backToLibrary")}</span>
            </Link>
            <SettingsLink href="/about">{t("about")}</SettingsLink>
          </div>
        </div>

        <div className="mx-auto w-full max-w-5xl">
          <div className="py-5 sm:py-6">
            <h1 className="text-2xl font-semibold tracking-heading text-text-primary sm:text-3xl">
              {t("title")}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {t("intro")}
            </p>
          </div>

          <SettingsTabs
            general={<GeneralSettings />}
            storage={<StorageSettings />}
            installation={<InstallationSettings />}
            agents={<AgentsSettings />}
          />
          <nav aria-label={t("supportNav")} className="mt-8 flex flex-wrap gap-2 border-t border-border-control pt-5">
            <SettingsLink href="/contact">{t("contact")}</SettingsLink>
            <SettingsLink href="/changelog">{t("changelog")}</SettingsLink>
            <SettingsLink href="/privacy">{t("privacy")}</SettingsLink>
          </nav>
        </div>
      </div>
    </ScrollPanel>
  );
}
