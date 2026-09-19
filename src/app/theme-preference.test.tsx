import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeControl } from "./theme-control";
import { setThemePreference, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "./theme-preference";

function setSystemTheme(theme: "light" | "dark") {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" && theme === "dark",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  document.querySelectorAll("style[data-theme-swap]").forEach(style => style.remove());
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  setSystemTheme("light");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("theme preference", () => {
  it("suppresses transitions during the theme swap and restores them after paint", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
    setThemePreference("dark");
    const override = document.querySelector("style[data-theme-swap]");
    expect(override).toHaveTextContent("transition:none !important");
    frames.shift()!(0);
    expect(override).toBeInTheDocument();
    frames.shift()!(16);
    expect(override?.isConnected).toBe(false);
  });
  it.each(["light", "dark"])("applies saved %s before hydration", (theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.eval(THEME_INIT_SCRIPT);
    expect(document.documentElement.dataset.theme).toBe(theme);
  });

  it.each([null, "invalid", "system"])("resolves %s to the current browser theme", (theme) => {
    if (theme) localStorage.setItem(THEME_STORAGE_KEY, theme);
    setSystemTheme("dark");
    window.eval(THEME_INIT_SCRIPT);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("uses the current browser theme when storage cannot be read", () => {
    setSystemTheme("dark");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => window.eval(THEME_INIT_SCRIPT)).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("toggles between light and dark and persists each choice", () => {
    render(<ThemeControl />);
    const control = screen.getByRole("button", { name: "Theme" });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(control).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(control);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(control).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(control);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("restores the saved choice and syncs another tab's changes", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(<ThemeControl />);
    const control = screen.getByRole("button", { name: "Theme" });
    expect(control).toHaveAttribute("aria-pressed", "true");
    act(() => {
      localStorage.setItem(THEME_STORAGE_KEY, "light");
      window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY }));
    });
    expect(control).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement.dataset.theme).toBe("light");
    act(() => {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(control).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("still switches when saving the preference is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<ThemeControl />);
    const control = screen.getByRole("button", { name: "Theme" });
    fireEvent.click(control);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(control).toHaveAttribute("aria-pressed", "true");
  });
});
