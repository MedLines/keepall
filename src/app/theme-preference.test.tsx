import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeControl } from "./theme-control";
import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "./theme-preference";

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

afterEach(() => vi.restoreAllMocks());

describe("theme preference", () => {
  it.each(["light", "dark", "system"])("applies saved %s before hydration", (theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.eval(THEME_INIT_SCRIPT);
    expect(document.documentElement.dataset.theme).toBe(theme);
  });

  it.each([null, "invalid"])("defaults to system for %s", (theme) => {
    if (theme) localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.eval(THEME_INIT_SCRIPT);
    expect(document.documentElement.dataset.theme).toBe("system");
  });

  it("uses system when storage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => window.eval(THEME_INIT_SCRIPT)).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe("system");
  });

  it("lets the user choose and persist a theme", () => {
    render(<ThemeControl />);
    const control = screen.getByRole("combobox", { name: "Theme" });
    fireEvent.change(control, { target: { value: "dark" } });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    fireEvent.change(control, { target: { value: "system" } });
    expect(document.documentElement.dataset.theme).toBe("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  });

  it("restores the selected option and syncs another tab's changes", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(<ThemeControl />);
    expect(screen.getByRole("combobox")).toHaveValue("dark");
    act(() => {
      localStorage.setItem(THEME_STORAGE_KEY, "light");
      window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY }));
    });
    expect(screen.getByRole("combobox")).toHaveValue("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    act(() => {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(screen.getByRole("combobox")).toHaveValue("system");
  });

  it("still switches when saving the preference is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<ThemeControl />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "dark" } });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("combobox")).toHaveValue("dark");
  });
});
