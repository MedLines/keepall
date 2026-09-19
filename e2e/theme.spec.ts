import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("toolbar dropdowns separate hovered and selected options", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  for (const theme of ["light", "dark"]) {
    if (await page.locator("html").getAttribute("data-theme") !== theme) await page.getByRole("button", { name: "Theme", exact: true }).click();
    for (const name of ["Sort library", "Filter by type"]) {
      await page.getByRole("button", { name, exact: true }).click();
      const menu = page.getByRole("listbox", { name });
      const options = menu.getByRole("option");
      await options.nth(1).click();
      await page.getByRole("button", { name, exact: true }).click();
      await options.first().hover();
      await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
      const first = (await options.first().boundingBox())!;
      const second = (await options.nth(1).boundingBox())!;
      expect(second.y - first.y - first.height).toBe(4);
      expect(first.height).toBeGreaterThanOrEqual(40);
      await menu.screenshot({ path: testInfo.outputPath(`${theme}-${name}.png`) });
      await page.keyboard.press("Escape");
    }
  }
});

test("layout switch slides one inset thumb and respects reduced motion", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  const control = page.getByRole("group", { name: "Library layout" });
  const thumb = control.locator(".library-layout-thumb");
  await expect(thumb).toHaveCount(1);
  expect(await control.boundingBox()).toMatchObject({ width: 88, height: 44 });
  expect(await thumb.boundingBox()).toMatchObject({ width: 42, height: 40 });
  await expect(control).toHaveCSS("border-radius", "14px");
  await expect(thumb).toHaveCSS("border-radius", "12px");
  if (await page.evaluate(() => CSS.supports("corner-shape", "round"))) {
    await expect(control).toHaveCSS("corner-shape", "round");
    await expect(thumb).toHaveCSS("corner-shape", "round");
  }
  await expect(thumb).toHaveCSS("transition-property", "transform");
  await expect(thumb).toHaveCSS("transition-duration", "0.18s");
  for (const theme of ["light", "dark"]) {
    const toggle = page.getByRole("button", { name: "Theme", exact: true });
    if ((await toggle.getAttribute("aria-pressed")) !== String(theme === "dark")) await toggle.click();
    for (const layout of ["List", "Grid"]) {
      const button = control.getByRole("button", { name: `${layout} view` });
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect.poll(async () => Math.round((await thumb.boundingBox())!.x - (await control.boundingBox())!.x))
        .toBe(layout === "List" ? 44 : 2);
      await control.screenshot({ path: testInfo.outputPath(`${theme}-${layout}.png`) });
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(thumb).toHaveCSS("transition-duration", "0s");
  await control.getByRole("button", { name: "List view" }).focus();
  await page.keyboard.press("Enter");
  await expect(control.getByRole("button", { name: "List view" })).toHaveAttribute("aria-pressed", "true");
});

test("shared controls use flat surfaces in both themes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  for (const theme of ["light", "dark"]) {
    const toggle = page.getByRole("button", { name: "Theme", exact: true });
    if ((await toggle.getAttribute("aria-pressed")) !== String(theme === "dark")) await toggle.click();
    await expect(page.locator(".library-panel")).toHaveCSS("background-color", theme === "light" ? "rgb(245, 245, 243)" : "rgb(14, 14, 15)");
    for (const name of ["Theme", "Save item", "Collapse", "Filter by type", "Sort library"]) {
      const button = page.getByRole("button", { name, exact: true });
      await expect(button).toHaveCSS("box-shadow", "none");
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    }
    const search = page.getByRole("searchbox", { name: "Search", exact: true });
    await expect(search).toHaveCSS("box-shadow", "none");
    expect((await search.boundingBox())!.width).toBe(250);
    const folderSearch = page.getByRole("textbox", { name: "Search collections" });
    await expect(folderSearch).toHaveAttribute("placeholder", "Search folders");
    await expect(folderSearch).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  }
});

test("theme toggles between light and dark and survives reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const theme = page.getByRole("button", { name: "Theme" });
  await expect(page.getByRole("combobox", { name: "Theme" })).toHaveCount(0);
  await expect(theme).toHaveAttribute("aria-pressed", "false");
  const panel = page.getByRole("main").locator("..");
  await expect(panel).toHaveCSS("background-color", "rgb(245, 245, 243)");
  await theme.click();
  await expect(panel).toHaveCSS("background-color", "rgb(14, 14, 15)");
  await page.reload();
  await expect(theme).toHaveAttribute("aria-pressed", "true");
  await expect(panel).toHaveCSS("background-color", "rgb(14, 14, 15)");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(panel).toHaveCSS("background-color", "rgb(14, 14, 15)");
  await theme.click();
  await expect(theme).toHaveAttribute("aria-pressed", "false");
  await expect(panel).toHaveCSS("background-color", "rgb(245, 245, 243)");
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  await page.getByLabel("Link, note, or image").fill("Theme review note");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("main").getByText("Theme review note", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("saved dark theme applies before the React bundles arrive", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Theme" }).click();
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(14, 14, 15)");
});

for (const width of [320, 768, 1024, 1440]) {
  test(`shell controls remain reachable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
    const close = page.getByRole("button", { name: width < 768 ? "Close navigation" : "Collapse", exact: true });
    if (await close.isVisible()) await close.click();
    const theme = page.getByRole("button", { name: "Theme" });
    if ((await theme.getAttribute("aria-pressed")) === "false") await theme.click();
    await theme.focus();
    await expect(theme).toBeFocused();
    const typeFilter = page.getByRole("button", { name: "Filter by type" });
    await typeFilter.click();
    await page.getByRole("option", { name: /Images/ }).click();
    await expect(typeFilter).toHaveAttribute("title", "Filter by type: Images");
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
  await expect(page.getByRole("button", { name: "Close navigation", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close navigation", exact: true }).click();
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
  expect(bounds).toMatchObject({ x: 256, y: shellTop + 10, width: 1174, height: 1100 - shellTop });
  await expect(panel).toHaveCSS("border-radius", "32px");
  expect(await page.getByRole("searchbox", { name: "Search", exact: true }).boundingBox()).toMatchObject({ x: 332, y: shellTop + 36, width: 250, height: 40 });
  expect(await page.getByRole("button", { name: "Collapse", exact: true }).boundingBox()).toMatchObject({ x: 280, y: shellTop + 36, width: 40, height: 40 });
  expect(await page.getByRole("group", { name: "Library layout" }).boundingBox()).toMatchObject({ x: 1318, y: shellTop + 102, width: 88, height: 44 });
  expect(await page.getByRole("button", { name: "Sort library" }).boundingBox()).toMatchObject({ x: 1266, y: shellTop + 102, width: 44, height: 44 });
  await page.getByRole("button", { name: "Collapse", exact: true }).click();
  await expect.poll(async () => (await panel.boundingBox())?.x).toBe(56);
  await expect(page.getByRole("button", { name: "Filter by type" })).toBeVisible();
  await page.getByRole("button", { name: "Expand", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await panel.boundingBox())?.x).toBe(256);
});
