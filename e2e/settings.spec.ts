import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("settings scrolls the whole page with sticky navigation and fixed Help", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.removeItem("keepall.storage-status-dismissed");
    navigator.storage.persist = async () => false;
  });
  await page.goto("/settings#storage");
  await expect(page.getByRole("tabpanel", { name: "Storage & backups", exact: true })).toBeVisible();
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const withBanner of [true, false]) {
      await page.reload();
      await expect(page.getByRole("tabpanel", { name: "Storage & backups", exact: true })).toBeVisible();
      if (!withBanner) {
        const dismiss = page.getByRole("button", { name: /Dismiss storage/ });
        if (await dismiss.isVisible()) await dismiss.click();
      }
      const dimensions = await page.getByRole("main").evaluate((main) => ({
        viewport: window.innerHeight,
        documentHeight: document.documentElement.scrollHeight,
        mainBottom: main.getBoundingClientRect().bottom,
        frameBottom: main.parentElement!.getBoundingClientRect().bottom,
        scrollAreas: [...document.querySelectorAll("*")].filter((element) => {
          const style = getComputedStyle(element);
          return ["auto", "scroll"].includes(style.overflowY) && element.clientHeight > 0 &&
            element.scrollHeight > element.clientHeight + 1;
        }).length,
      }));
      expect(dimensions.mainBottom).toBeLessThanOrEqual(dimensions.frameBottom + 1);
      expect(dimensions.documentHeight).toBeLessThanOrEqual(dimensions.viewport + 1);
      expect(dimensions.scrollAreas).toBe(1);
      expect(await page.getByRole("main").evaluate((main) =>
        main.scrollHeight > main.clientHeight && getComputedStyle(main).overflowY === "auto"
      )).toBe(true);
      expect(await page.getByTestId("settings-content").evaluate((content) =>
        content.scrollHeight <= content.clientHeight + 1 && getComputedStyle(content).overflowY === "visible"
      )).toBe(true);
      await page.getByRole("main").evaluate((main) => { main.scrollTop = main.scrollHeight; });
      await expect(page.getByRole("heading", { name: "Settings", exact: true })).not.toBeInViewport();
      await expect(page.getByRole("tablist", { name: "Settings", exact: true })).toBeInViewport();
      await expect(page.getByRole("link", { name: "Help & guides", exact: true })).toBeInViewport();
      await expect(page.getByRole("button", { name: "Choose backup folder", exact: true })).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath(`settings-bottom-${width}-${withBanner}.png`) });
    }
  }
});

test("settings tabs explain storage, connectivity, installation and recovery", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/settings");
  const tabs = page.getByRole("tablist", { name: "Settings", exact: true });
  await expect(tabs).toHaveAttribute("aria-orientation", "vertical");
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await expect(page.getByRole("tabpanel", { name: "General", exact: true })).toContainText("Only the page address is sent");
  await page.getByRole("tab", { name: "General", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  const storage = page.getByRole("tabpanel", { name: "Storage & backups", exact: true });
  await expect(storage).toBeVisible();
  await expect(storage).toContainText("this browser profile on this device");
  await expect(storage).toContainText("Other profiles and devices have separate libraries");
  await expect(page.getByText("Cloud sync", { exact: true })).toHaveCount(0);
  await expect(storage).toContainText("Original websites");
  await expect(storage).toContainText("Clearing site data erases this library");
  await expect(storage).toContainText("Use Import backup");
  await expect(storage.getByRole("button", { name: "Export backup", exact: true })).toBeEnabled();
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("storage-desktop.png") });
  await page.reload();
  await expect(storage).toBeVisible();

  await page.getByRole("tab", { name: "Installation", exact: true }).click();
  const installation = page.getByRole("tabpanel", { name: "Installation", exact: true });
  await expect(installation).toContainText("separate storage from Safari");
  await expect(installation).toContainText("A first visit or an uncached page");
  await installation.getByRole("link", { name: "Back up or transfer your library" }).click();
  await expect(storage).toBeVisible();
  await expect(page.getByRole("heading", { name: "Backup", exact: true })).toBeInViewport();
  await page.goBack();
  await expect(installation).toBeVisible();

  await expect(page.getByRole("tab", { name: "Help", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Help & guides", exact: true })).toHaveAttribute("href", "/help");
  expect(errors).toEqual([]);
});

test("recovery links open backup settings and bulk import opens from capture", async ({ page }) => {
  await page.goto("/settings#backup-heading");
  await expect(page.getByRole("tab", { name: "Storage & backups", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Import backup", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Backup", exact: true })).toBeInViewport();
  await page.goto("/settings#constructor");
  await expect(page.getByRole("tabpanel", { name: "General", exact: true })).toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: "Save your first item", exact: true }).click();
  await page.getByRole("button", { name: "Bulk import", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Bulk import", exact: true }).getByRole("button", { name: "Import bookmarks HTML", exact: true })).toBeVisible();
});

test("settings labels and keyboard navigation work on narrow screens in both themes", async ({ page }, testInfo) => {
  await page.goto("/settings");
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const tabs = page.getByRole("tablist", { name: "Settings", exact: true });
    await expect(tabs).toHaveAttribute("data-orientation", width < 768 ? "horizontal" : "vertical");
    for (const theme of ["light", "dark"]) {
      await page.getByRole("tab", { name: "General", exact: true }).click();
      if (await page.locator("html").getAttribute("data-theme") !== theme) {
        await page.getByRole("button", { name: "Theme", exact: true }).click();
      }
      const storageTab = page.getByRole("tab", { name: "Storage & backups", exact: true });
      const unselectedHeight = await storageTab.evaluate((tab) => tab.getBoundingClientRect().height);
      await page.getByRole("tab", { name: "General", exact: true }).focus();
      await page.keyboard.press(width < 768 ? "ArrowRight" : "ArrowDown");
      await expect(page.getByRole("tabpanel", { name: "Storage & backups", exact: true })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Storage & backups", exact: true })).toHaveAttribute("aria-selected", "true");
      expect(await storageTab.evaluate((tab) => tab.getBoundingClientRect().height)).toBe(unselectedHeight);
      if (width >= 768) {
        const label = storageTab.locator("span");
        expect(await label.evaluate((text) => text.getBoundingClientRect().height <= parseFloat(getComputedStyle(text).lineHeight) + 1)).toBe(true);
      }
      for (const tab of await tabs.getByRole("tab").all()) await expect(tab).toBeVisible();
      expect(await page.locator("main").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: testInfo.outputPath(`settings-${width}-${theme}.png`) });
      await page.keyboard.press("End");
      await expect(page.getByRole("tabpanel", { name: "Installation", exact: true })).toBeVisible();
      await page.keyboard.press("Home");
      await expect(page.getByRole("tabpanel", { name: "General", exact: true })).toBeVisible();
    }
  }
});
