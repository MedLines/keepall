"use client";

import { KeyboardShortcutsSettings } from "./keyboard-shortcuts-settings";
import { BackupPanel } from "../backup-panel";
import { BackupIcon, DeviceIcon, GridIcon, InternetIcon, NoteIcon, OfflineIcon } from "../shell-icons";
import { ThemeControl } from "../theme-control";
import { LanguageSetting } from "../language-setting";
import { SettingsLink } from "./settings-link";
import { StorageHealth } from "./storage-health";
import { useTranslations } from "@/i18n/use-translations";

export const sectionClass = "library-panel border border-border-control bg-bg-surface p-5 sm:p-6";
export const headingClass = "text-lg font-semibold text-text-primary";
export const paragraphClass = "mt-1 text-sm leading-6 text-text-secondary";
const iconClass = "mt-0.5 size-5 text-text-secondary";

export function GeneralSettings() {
  const t = useTranslations("GeneralSettings");
  return <>
    <section className={sectionClass} aria-labelledby="appearance-heading">
      <h2 id="appearance-heading" className={headingClass}>{t("appearance")}</h2>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text-primary">{t("theme")}</p>
          <p className="mt-1 text-xs text-text-secondary">{t("themeDescription")}</p>
        </div>
        <ThemeControl />
      </div>
      <LanguageSetting />
    </section>
    <KeyboardShortcutsSettings />
    <section className={sectionClass} aria-labelledby="network-heading">
      <h2 id="network-heading" className={headingClass}>{t("linkPreviews")}</h2>
      <p className={paragraphClass}>{t("linkPreviewsIntro")}</p>
      <ul className="my-5 space-y-3 text-sm text-text-secondary">
        <li className="flex items-start gap-3"><InternetIcon className={iconClass} /><span>{t("previewAddressOnly")}</span></li>
        <li className="flex items-start gap-3"><NoteIcon className={iconClass} /><span>{t("previewLocalData")}</span></li>
      </ul>
      <p className={paragraphClass}>{t("previewRequests")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <SettingsLink href="/help/storage-and-backups#previews">{t("previewsGuide")}</SettingsLink>
        <SettingsLink href="/privacy">{t("privacyGuide")}</SettingsLink>
      </div>
    </section>
  </>;
}

export function StorageSettings() {
  const t = useTranslations("StorageSettings");
  return <>
    <section className={sectionClass} aria-labelledby="storage-heading">
      <h2 id="storage-heading" className={headingClass}>{t("storage")}</h2>
      <p className={paragraphClass}>{t("intro")}</p>
      <dl className="mt-5 grid gap-x-6 gap-y-5 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-3">
          <DeviceIcon className={iconClass} />
          <div><dt className="font-medium text-text-primary">{t("whereTitle")}</dt>
            <dd className="mt-1 leading-5 text-text-secondary">{t("whereBody")}</dd></div>
        </div>
        <div className="flex items-start gap-3">
          <OfflineIcon className={iconClass} />
          <div><dt className="font-medium text-text-primary">{t("offlineTitle")}</dt>
            <dd className="mt-1 leading-5 text-text-secondary">{t("offlineBody")}</dd></div>
        </div>
        <div className="flex items-start gap-3">
          <InternetIcon className={iconClass} />
          <div><dt className="font-medium text-text-primary">{t("internetTitle")}</dt>
            <dd className="mt-1 leading-5 text-text-secondary">{t("internetBody")}</dd></div>
        </div>
        <div className="flex items-start gap-3">
          <BackupIcon className={iconClass} />
          <div><dt className="font-medium text-text-primary">{t("recoveryTitle")}</dt>
            <dd className="mt-1 leading-5 text-text-secondary">{t("recoveryBody")}</dd></div>
        </div>
      </dl>
      <StorageHealth />
      <div className="mt-4 flex flex-wrap gap-2">
        <SettingsLink href="/help/storage-and-backups">{t("storageGuide")}</SettingsLink>
        <SettingsLink href="/help/offline">{t("offlineGuide")}</SettingsLink>
      </div>
    </section>
    <BackupPanel />
  </>;
}

const iosSteps = ["export", "open", "import"] as const;

export function InstallationSettings() {
  const t = useTranslations("InstallationSettings");
  return <>
    <section className={sectionClass} aria-labelledby="installation-heading">
      <div className="flex items-start gap-3">
        <GridIcon className="mt-1 size-6 text-text-secondary" />
        <div><h2 id="installation-heading" className={headingClass}>{t("install")}</h2>
          <p className={paragraphClass}>{t("installIntro")}</p></div>
      </div>
      <div className="mt-5"><SettingsLink href="/help/install-keepall" primary>{t("installGuide")}</SettingsLink></div>
      <div className="mt-5 border-t border-border-control pt-5">
        <h3 className="text-sm font-medium text-text-primary">{t("iosTitle")}</h3>
        <p className={paragraphClass}>{t("iosIntro")}</p>
        <ol className="my-4 flex flex-wrap gap-2 text-xs text-text-secondary">
          {iosSteps.map((step, index) => <li key={step} className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-bg-raised font-medium text-text-primary">{index + 1}</span>{t(`iosSteps.${step}`)}
          </li>)}
        </ol>
        <SettingsLink href="#backup-heading">{t("transferLink")}</SettingsLink>
        <p className="mt-3 text-xs text-text-secondary">{t("keepOriginal")}</p>
      </div>
    </section>
    <section className={sectionClass} aria-labelledby="offline-heading">
      <div className="flex items-start gap-3">
        <OfflineIcon className={iconClass} />
        <div><h2 id="offline-heading" className="text-sm font-medium text-text-primary">{t("onlineFirst")}</h2>
          <p className={paragraphClass}>{t("onlineFirstIntro")}</p></div>
      </div>
      <div className="mt-4"><SettingsLink href="/help/offline">{t("offlineGuide")}</SettingsLink></div>
    </section>
    <section className={sectionClass} aria-labelledby="extension-heading">
      <div className="flex items-start gap-3">
        <DeviceIcon className={iconClass} />
        <div><h2 id="extension-heading" className="text-sm font-medium text-text-primary">{t("extension")}</h2>
          <p className={paragraphClass}>{t("extensionIntro")}</p></div>
      </div>
      <div className="mt-4"><SettingsLink href="/help/chrome-capture">{t("extensionGuide")}</SettingsLink></div>
    </section>
  </>;
}
