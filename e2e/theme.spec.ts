import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("theme follows System, respects overrides, and survives reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const theme = page.getByRole("combobox", { name: "Theme" });
  await expect(theme).toHaveValue("system");
  const panel = page.getByRole("main").locator("..");
  await expect(panel).toHaveCSS("background-color", "rgb(244, 244, 242)");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(panel).toHaveCSS("background-color", "rgb(18, 18, 18)");
  await theme.selectOption("light");
  await expect(panel).toHaveCSS("background-color", "rgb(244, 244, 242)");
  await page.reload();
  await expect(theme).toHaveValue("light");
  await expect(panel).toHaveCSS("background-color", "rgb(244, 244, 242)");
  await theme.selectOption("dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(panel).toHaveCSS("background-color", "rgb(18, 18, 18)");
  await page.getByRole("button", { name: "Save item", exact: true }).click();
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
    const close = page.getByRole("button", { name: width < 768 ? "Close navigation" : "Collapse", exact: true });
    if (await close.isVisible()) await close.click();
    const theme = page.getByRole("combobox", { name: "Theme" });
    await theme.selectOption("dark");
    await theme.focus();
    await expect(theme).toBeFocused();
    await page.getByRole("button", { name: "Images", exact: true }).click();
    await expect(page.getByRole("button", { name: "Images", exact: true })).toHaveAttribute("aria-current", "page");
    await page.getByRole("button", { name: "Sort library" }).click();
    await expect(page.getByRole("option", { name: "Oldest" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "List view" }).click();
    await expect(page.getByRole("button", { name: "List view" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Expand", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Search collections" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Search tags" })).toBeVisible();
    await page.getByRole("button", { name: "Collections", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Search collections" })).toBeHidden();
    await expect(page.getByRole("textbox", { name: "Search tags" })).toBeVisible();
    await page.getByRole("button", { name: "All items", exact: true }).click();
    const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflowing).toBe(false);
    await expect(page.getByRole("button", { name: "Save item", exact: true })).toBeInViewport();
  });
}

test("a populated grid fits the narrow content panel", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/");
  if (await page.getByRole("button", { name: "Close navigation", exact: true }).isVisible()) {
    await page.getByRole("button", { name: "Close navigation", exact: true }).click();
  }
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  await page.getByLabel("Link, note, or image").fill("A narrow-screen note");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("main").getByText("A narrow-screen note", { exact: true })).toBeVisible();
  await expect.poll(() => page.getByRole("main").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test("desktop shell keeps search and view controls inside the inset panel", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1120 });
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  const panel = page.getByRole("main").locator("..");
  const bounds = await panel.boundingBox();
  // Runtime storage/offline notices sit above the shell, outside the design frame.
  const shellTop = (await panel.locator("..").boundingBox())!.y;
  expect(bounds).toMatchObject({ x: 224, y: shellTop + 10, width: 1206, height: 1100 - shellTop });
  await expect(panel).toHaveCSS("border-radius", "20px");
  expect(await page.getByRole("searchbox", { name: "Search", exact: true }).boundingBox()).toMatchObject({ x: 304, y: shellTop + 34, width: 360, height: 44 });
  expect(await page.getByRole("button", { name: "Collapse", exact: true }).boundingBox()).toMatchObject({ x: 248, y: shellTop + 34, width: 44, height: 44 });
  expect(await page.getByRole("group", { name: "Library layout" }).boundingBox()).toMatchObject({ x: 1262, y: shellTop + 102, width: 88, height: 44 });
  expect(await page.getByRole("button", { name: "Sort library" }).boundingBox()).toMatchObject({ x: 1362, y: shellTop + 102, width: 44, height: 44 });
  await page.getByRole("button", { name: "Collapse", exact: true }).click();
  await expect.poll(async () => (await panel.boundingBox())?.x).toBe(56);
  await expect(page.getByRole("button", { name: "Images", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Expand", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await panel.boundingBox())?.x).toBe(224);
});
