import { AVAILABLE_LANGUAGES, DEFAULT_LANGUAGE, isLanguage, matchBrowserLanguage, type Language } from "./locales";

export const LANGUAGE_STORAGE_KEY = "keepall-language-v1";
const LANGUAGE_CHANGED_EVENT = "keepall-language-changed";

/** The browser's preferred languages; empty where the browser reports none. */
export function readBrowserLanguages(): string[] {
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return languages.filter((tag): tag is string => typeof tag === "string" && tag !== "");
}

function readSavedLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch {
    // Blocked storage falls back to the browser's languages.
  }
  return matchBrowserLanguage(readBrowserLanguages());
}

/** <html lang> holds the interface language; the init script sets it before the first paint. */
export function getLanguageSnapshot(): Language {
  const current = document.documentElement.lang;
  return isLanguage(current) ? current : DEFAULT_LANGUAGE;
}

export function getServerLanguageSnapshot(): Language {
  return DEFAULT_LANGUAGE;
}

export function subscribeToLanguage(onChange: () => void): () => void {
  // Also restores the attribute after a development Strict Mode remount.
  document.documentElement.lang = readSavedLanguage();
  function onStorage(event: StorageEvent) {
    if (event.key !== null && event.key !== LANGUAGE_STORAGE_KEY) return;
    document.documentElement.lang = readSavedLanguage();
    onChange();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(LANGUAGE_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LANGUAGE_CHANGED_EVENT, onChange);
  };
}

export function setLanguagePreference(language: Language): void {
  document.documentElement.lang = language;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The selection still works for this page when browser storage is blocked.
  }
  window.dispatchEvent(new Event(LANGUAGE_CHANGED_EVENT));
}

// Static, trusted source only. Runs before the first paint. It sets <html lang> only: text that the
// server rendered in English switches to the saved language when the page hydrates.
export const LANGUAGE_INIT_SCRIPT = `(()=>{const a=${JSON.stringify(AVAILABLE_LANGUAGES)};let l;try{l=localStorage.getItem("${LANGUAGE_STORAGE_KEY}")}catch{}if(!a.includes(l)){l="${DEFAULT_LANGUAGE}";for(const t of navigator.languages?.length?navigator.languages:[navigator.language]){const b=String(t??"").split("-")[0].toLowerCase();if(a.includes(b)){l=b;break}}}document.documentElement.lang=l})()`;
