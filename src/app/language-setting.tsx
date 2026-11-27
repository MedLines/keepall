"use client";

import { AVAILABLE_LANGUAGES, languageName, type Language } from "@/i18n/locales";
import { setLanguagePreference } from "@/i18n/locale-preference";
import { useLanguage, useTranslations } from "@/i18n/use-translations";
import { ShellTopMenu } from "./shell-top-menu";

/**
 * Settings row that picks the interface language and saves it on this device. Renders nothing
 * while only one language is available, so production shows it once a second catalogue lands.
 *
 * @import import { LanguageSetting } from "@/app/language-setting";
 */
export function LanguageSetting({ languages = AVAILABLE_LANGUAGES }: { languages?: readonly Language[] }) {
  const language = useLanguage();
  const t = useTranslations("LanguageSetting");
  if (languages.length < 2) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-text-primary">{t("label")}</p>
        <p className="mt-1 text-xs text-text-secondary">{t("description")}</p>
      </div>
      <ShellTopMenu<Language>
        ariaLabel={t("label")}
        variant="control"
        value={language}
        options={languages.map((value) => ({ value, label: languageName(value) }))}
        onChange={setLanguagePreference}
      />
    </div>
  );
}
