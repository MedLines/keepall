/**
 * Languages Keepall's interface can show. A language is the BCP 47 tag of one message catalogue
 * in src/i18n/messages; "en-XA" is the pseudo-locale, built from English, that shows untranslated
 * text and tight layouts during development.
 */
export const LANGUAGES = ["en", "en-XA"] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "en";
export const PSEUDO_LANGUAGE: Language = "en-XA";

/** What the language picker offers: the pseudo-locale only outside production builds. */
export const AVAILABLE_LANGUAGES: readonly Language[] = process.env.NODE_ENV === "production"
  ? LANGUAGES.filter((language) => language !== PSEUDO_LANGUAGE)
  : LANGUAGES;

export function isLanguage(value: string | null | undefined, available: readonly Language[] = AVAILABLE_LANGUAGES): value is Language {
  return (available as readonly string[]).includes(value ?? "");
}

const baseLanguage = (tag: string) => tag.split("-")[0].toLowerCase();

/** The first available language that matches the browser's preferred languages, or English. */
export function matchBrowserLanguage(browserLanguages: readonly string[], available: readonly Language[] = AVAILABLE_LANGUAGES): Language {
  for (const tag of browserLanguages) {
    const exact = available.find((language) => language.toLowerCase() === tag.toLowerCase());
    if (exact && exact !== PSEUDO_LANGUAGE) return exact;
    const base = available.find((language) => language === baseLanguage(tag));
    if (base) return base;
  }
  return DEFAULT_LANGUAGE;
}

/**
 * The locale for dates and numbers. It keeps the browser's regional variant of the interface
 * language (en-GB dates for an en-GB browser showing English) and otherwise uses the language
 * itself, so dates never switch language mid-sentence.
 */
export function formatLocaleFor(language: Language, browserLanguages: readonly string[]): string {
  const base = baseLanguage(language);
  return browserLanguages.find((tag) => baseLanguage(tag) === base) ?? language;
}

/** Each language's name in that language, for the picker. */
export function languageName(language: Language): string {
  if (language === PSEUDO_LANGUAGE) return "Pseudo-locale (en-XA)";
  return new Intl.DisplayNames([language], { type: "language" }).of(language) ?? language;
}
