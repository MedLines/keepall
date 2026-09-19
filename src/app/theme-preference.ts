export type ThemePreference = "light" | "dark";

export const THEME_STORAGE_KEY = "keepall-theme-v1";
const THEME_CHANGED_EVENT = "keepall-theme-changed";

function readBrowserTheme(): ThemePreference {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function parseTheme(value: string | null | undefined): ThemePreference {
  return value === "light" || value === "dark" ? value : readBrowserTheme();
}

function readSavedTheme(): ThemePreference {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return readBrowserTheme();
  }
}

function applyTheme(theme: ThemePreference): void {
  if (document.documentElement.dataset.theme === theme) return;
  const override = document.createElement("style");
  override.dataset.themeSwap = "";
  override.textContent = "*,*::before,*::after{transition:none !important}";
  document.head.append(override);
  document.documentElement.dataset.theme = theme;
  void document.body.offsetHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => override.remove()));
}

export function getThemeSnapshot(): ThemePreference {
  return parseTheme(document.documentElement.dataset.theme);
}

export function getServerThemeSnapshot(): ThemePreference {
  return "light";
}

export function subscribeToTheme(onChange: () => void): () => void {
  // Also restores the attribute after a development Strict Mode remount.
  document.documentElement.dataset.theme = readSavedTheme();
  function onStorage(event: StorageEvent) {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
    applyTheme(readSavedTheme());
    onChange();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_CHANGED_EVENT, onChange);
  };
}

export function setThemePreference(theme: ThemePreference): void {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The selection still works for this page when browser storage is blocked.
  }
  window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
}

// Static, trusted source only. Runs before the first paint.
export const THEME_INIT_SCRIPT = `(()=>{let t=window.matchMedia?.("(prefers-color-scheme: dark)").matches?"dark":"light";try{const s=localStorage.getItem("${THEME_STORAGE_KEY}");if(s==="light"||s==="dark")t=s}catch{}document.documentElement.dataset.theme=t})()`;
