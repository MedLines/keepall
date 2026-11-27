import { act, fireEvent, render, screen } from "@testing-library/react";
import { createTranslator } from "use-intl/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageSetting } from "@/app/language-setting";
import { ThemeControl } from "@/app/theme-control";
import { formatLocaleFor, matchBrowserLanguage } from "./locales";
import { LANGUAGE_INIT_SCRIPT, LANGUAGE_STORAGE_KEY, setLanguagePreference } from "./locale-preference";
import { en } from "./messages/en";
import { pseudoCatalogue, pseudoMessage } from "./pseudo";
import { LanguageOverrideContext, useFormatLocale, useTranslations } from "./use-translations";

function stubBrowserLanguages(languages: string[]) {
  vi.spyOn(navigator, "languages", "get").mockReturnValue(languages);
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = "en";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pseudo-locale", () => {
  it("stretches text but keeps arguments, plural keys, # and tags", () => {
    expect(pseudoMessage("Save {name}")).toBe("⟦Šááṽé {name}⟧");
    const plural = pseudoMessage("{count, plural, one {# item} other {# items}} in <b>Inbox</b>");
    expect(plural).toMatch(/^⟦\{count, plural, one \{# [^{}]+\} other \{# [^{}]+\}\} [^<]+ <b>[^<]+<\/b>⟧$/);
    expect(plural).not.toMatch(/item|Inbox/);
  });

  it("still formats as ICU, plurals included", () => {
    const messages = pseudoCatalogue({ Library: { count: "{count, plural, one {# item} other {# items}}" } });
    const t = createTranslator({ locale: "en-XA", messages, namespace: "Library" });
    expect(t("count", { count: 1 })).toBe("⟦1 îîţéɱ⟧");
    expect(t("count", { count: 3 })).toBe("⟦3 îîţéɱš⟧");
  });

  it("covers every English message", () => {
    const keys = (messages: object): string[] => Object.entries(messages).flatMap(([key, value]) =>
      typeof value === "string" ? [key] : keys(value).map((child) => `${key}.${child}`));
    expect(keys(pseudoCatalogue(en))).toEqual(keys(en));
  });
});

describe("locales", () => {
  it("matches the browser's languages by base language, never to the pseudo-locale", () => {
    expect(matchBrowserLanguage(["fr-FR", "en-GB"])).toBe("en");
    expect(matchBrowserLanguage(["en-XA"])).toBe("en");
    expect(matchBrowserLanguage(["ja"])).toBe("en");
  });

  it("formats with the browser's regional variant of the interface language", () => {
    expect(formatLocaleFor("en", ["en-GB", "en-US"])).toBe("en-GB");
    expect(formatLocaleFor("en", ["fr-FR"])).toBe("en");
    expect(formatLocaleFor("en-XA", ["de-DE", "en-AU"])).toBe("en-AU");
  });
});

describe("language init script", () => {
  it("applies a saved language before the first paint", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "en-XA");
    window.eval(LANGUAGE_INIT_SCRIPT);
    expect(document.documentElement.lang).toBe("en-XA");
  });

  it("ignores an unknown saved value and agrees with matchBrowserLanguage", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "klingon");
    stubBrowserLanguages(["fr-FR", "en-GB"]);
    document.documentElement.lang = "";
    window.eval(LANGUAGE_INIT_SCRIPT);
    expect(document.documentElement.lang).toBe(matchBrowserLanguage(["fr-FR", "en-GB"]));
  });

  it("survives a browser that reports no language", () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(undefined as unknown as string[]);
    vi.spyOn(navigator, "language", "get").mockReturnValue(undefined as unknown as string);
    document.documentElement.lang = "";
    expect(() => window.eval(LANGUAGE_INIT_SCRIPT)).not.toThrow();
    expect(document.documentElement.lang).toBe("en");
    expect(() => render(<Probe />)).not.toThrow();
  });

  it("survives blocked storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => window.eval(LANGUAGE_INIT_SCRIPT)).not.toThrow();
    expect(document.documentElement.lang).toBe("en");
  });
});

function Probe() {
  const t = useTranslations("ThemeControl");
  const locale = useFormatLocale();
  // @ts-expect-error -- keys are checked against the English catalogue
  void (() => t("missing"));
  return <p data-locale={locale}>{t("switchToDark")}</p>;
}

describe("useTranslations", () => {
  it("renders English by default", () => {
    render(<Probe />);
    expect(screen.getByText("Switch to dark theme")).toBeInTheDocument();
  });

  it("follows a language override", () => {
    render(<LanguageOverrideContext value="en-XA"><Probe /></LanguageOverrideContext>);
    expect(screen.getByText(pseudoMessage("Switch to dark theme"))).toBeInTheDocument();
  });

  it("re-renders when the preference changes and keeps the browser's region for formatting", () => {
    stubBrowserLanguages(["en-GB"]);
    render(<Probe />);
    act(() => setLanguagePreference("en-XA"));
    expect(document.documentElement.lang).toBe("en-XA");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en-XA");
    expect(screen.getByText(pseudoMessage("Switch to dark theme"))).toHaveAttribute("data-locale", "en-GB");
  });
});

describe("LanguageSetting", () => {
  it("is hidden while only one language is available", () => {
    const { container } = render(<LanguageSetting languages={["en"]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("switches the interface language", () => {
    render(<><LanguageSetting languages={["en", "en-XA"]} /><ThemeControl /></>);
    expect(screen.getByRole("button", { name: "Theme" })).toHaveTextContent("Light theme");
    fireEvent.click(screen.getByRole("combobox", { name: /Language/ }));
    const option = screen.getByRole("option", { name: "Pseudo-locale (en-XA)" });
    fireEvent.pointerDown(option, { pointerType: "mouse", button: 0 });
    fireEvent.pointerUp(option, { pointerType: "mouse", button: 0 });
    fireEvent.click(option);
    expect(screen.getByRole("button", { name: pseudoMessage("Theme") })).toHaveTextContent(pseudoMessage("Light theme"));
    expect(document.documentElement.lang).toBe("en-XA");
  });
});
