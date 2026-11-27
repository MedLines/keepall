/**
 * English interface text, the source catalogue. Group keys by the component that shows them and
 * write ICU messages (https://formatjs.io/docs/core-concepts/icu-syntax): a whole sentence per key,
 * with {placeholders} and plurals inside it, never sentences glued together from pieces.
 */
export const en = {
  LanguageSetting: {
    label: "Language",
    description: "Saved on this device.",
  },
  ThemeControl: {
    label: "Theme",
    light: "Light theme",
    dark: "Dark theme",
    switchToLight: "Switch to light theme",
    switchToDark: "Switch to dark theme",
  },
} as const;

type Catalogue<T> = { readonly [Key in keyof T]: T[Key] extends string ? string : Catalogue<T[Key]> };

/** The shape every other language's catalogue must match, key for key. */
export type Messages = Catalogue<typeof en>;
