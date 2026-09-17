import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("theme follows System, respects overrides, and survives reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const theme = page.getByRole("combobox", { name: "Theme" });
  await expect(theme).toHaveValue("system");
  await expect(page.getByRole("main")).toHaveCSS("background-color", "rgb(244, 244, 242)");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.getByRole("main")).toHaveCSS("background-color", "rgb(18, 18, 18)");
  await theme.selectOption("light");
  await expect(page.getByRole("main")).toHaveCSS("background-color", "rgb(244, 244, 242)");
  await page.reload();
  await expect(theme).toHaveValue("light");
  await expect(page.getByRole("main")).toHaveCSS("background-color", "rgb(244, 244, 242)");
  await theme.selectOption("dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.getByRole("main")).toHaveCSS("background-color", "rgb(18, 18, 18)");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Link, note, or image").fill("Theme review note");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("main").getByText("Theme review note", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("saved dark theme applies before the React bundles arrive", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Theme" }).selectOption("dark");
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(18, 18, 18)");
});

for (const width of [320, 768, 1024, 1440]) {
  test(`shell controls remain reachable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
    if (await page.getByRole("button", { name: "Collapse", exact: true }).isVisible()) {
      await page.getByRole("button", { name: "Collapse", exact: true }).click();
    }
    const theme = page.getByRole("combobox", { name: "Theme" });
    await theme.selectOption("dark");
    await theme.focus();
    await expect(theme).toBeFocused();
    await page.getByRole("button", { name: "Filter by type" }).click();
    await expect(page.getByRole("listbox", { name: "Filter by type" })).toBeInViewport({ ratio: 1 });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Sort library" }).click();
    await expect(page.getByRole("option", { name: "Oldest" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Library layout" }).click();
    await page.getByRole("option", { name: "List", exact: true }).click();
    await page.getByRole("button", { name: "Expand", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Search collections" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Search tags" })).toBeVisible();
    await page.getByRole("button", { name: "Collections", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Search collections" })).toBeHidden();
    await expect(page.getByRole("textbox", { name: "Search tags" })).toBeVisible();
    await page.getByRole("button", { name: "All items", exact: true }).click();
    const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflowing).toBe(false);
    await expect(page.getByRole("button", { name: "Add", exact: true })).toBeInViewport();
  });
}

test("a populated grid fits the narrow content panel", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/");
  if (await page.getByRole("button", { name: "Collapse", exact: true }).isVisible()) {
    await page.getByRole("button", { name: "Collapse", exact: true }).click();
  }
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Link, note, or image").fill("A narrow-screen note");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("main").getByText("A narrow-screen note", { exact: true })).toBeVisible();
  await expect.poll(() => page.getByRole("main").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});
