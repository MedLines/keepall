import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { createTranslator, type NamespaceKeys, type NestedKeyOf } from "use-intl/core";
import { formatLocaleFor, PSEUDO_LANGUAGE, type Language } from "./locales";
import { getLanguageSnapshot, getServerLanguageSnapshot, readBrowserLanguages, subscribeToLanguage } from "./locale-preference";
import { en } from "./messages/en";
import { pseudoCatalogue } from "./pseudo";

export type Namespace = NamespaceKeys<typeof en, NestedKeyOf<typeof en>>;

/** The `t` that useTranslations(namespace) returns, for helpers that format text outside a component. */
export type Translations<N extends Namespace> = ReturnType<typeof useTranslations<N>>;

let pseudo: typeof en | undefined;
function catalogue(language: Language): typeof en {
  if (language !== PSEUDO_LANGUAGE) return en;
  pseudo ??= pseudoCatalogue(en);
  return pseudo;
}

/** Storybook (and tests) pin a language here instead of reading the saved preference. */
export const LanguageOverrideContext = createContext<Language | null>(null);

/** The interface language. Renders English on the server and during hydration, then the saved one. */
export function useLanguage(): Language {
  const override = useContext(LanguageOverrideContext);
  const saved = useSyncExternalStore(subscribeToLanguage, getLanguageSnapshot, getServerLanguageSnapshot);
  return override ?? saved;
}

const noBrowserLanguages = () => null;
const browserLanguages = () => readBrowserLanguages().join(",");
const subscribeNever = () => () => {};

/**
 * The locale for Intl date and number formatting. Undefined on the server and during hydration,
 * which is the runtime default, as before.
 */
export function useFormatLocale(): string | undefined {
  const language = useLanguage();
  const languages = useSyncExternalStore(subscribeNever, browserLanguages, noBrowserLanguages);
  return languages === null ? undefined : formatLocaleFor(language, languages ? languages.split(",") : []);
}

/**
 * Interface text for one component, from src/i18n/messages. Keys and ICU arguments are typed
 * against the English catalogue, so `t("missing")` or a missing `{count}` fails typecheck.
 *
 * @example const t = useTranslations("ThemeControl"); t("switchToDark")
 */
export function useTranslations<N extends Namespace>(namespace: N) {
  const language = useLanguage();
  return useMemo(
    () => createTranslator({ locale: language, messages: catalogue(language), namespace }),
    [language, namespace],
  );
}
