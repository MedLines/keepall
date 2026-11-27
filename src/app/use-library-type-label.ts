import { selectedLibraryTypes, type LibraryTypeSelection } from "@/domain/library-view";
import { useFormatLocale, useTranslations } from "@/i18n/use-translations";

/**
 * Names a type filter in the interface language: "Images, Links", or null when no type is selected.
 * The domain's libraryTypeSelectionLabel stays English for agent-facing text such as Context Packs.
 */
export function useLibraryTypeLabel() {
  const t = useTranslations("LibraryTypes");
  const locale = useFormatLocale();
  return (value: LibraryTypeSelection): string | null => {
    const types = selectedLibraryTypes(value);
    return types.length ? new Intl.ListFormat(locale, { type: "unit", style: "short" }).format(types.map((type) => t(type))) : null;
  };
}

/** "image or link": the selected types as a lowercase alternative, for "Searching … items". */
export function useLibraryTypeAlternatives() {
  const t = useTranslations("LibraryTypes");
  const locale = useFormatLocale();
  return (value: LibraryTypeSelection): string | null => {
    const types = selectedLibraryTypes(value);
    return types.length ? new Intl.ListFormat(locale, { type: "disjunction" }).format(types.map((type) => t(`singular.${type}`))) : null;
  };
}
