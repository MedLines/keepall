import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("settings crossfades without overlapping live panels and resets scrolling", async ({ page }) => {
  await page.goto("/settings");
  const viewport = page.getByRole("main").locator('[data-slot="scroll-area-viewport"]').first();
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 825 });
    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      await page.emulateMedia({ reducedMotion });
      await page.getByRole("tab", { name: "General", exact: true }).click();
      await expect(page.getByRole("tabpanel", { name: "General", exact: true })).toBeVisible();
      await expect.poll(() => page.getByTestId("settings-content").evaluate((element) => element.style.viewTransitionName)).toBe("");
      for (const name of ["Storage & backups", "Installation", "General"]) {
        await viewport.evaluate((element) => { element.scrollTop = 300; });
        const frames = page.evaluate(() => new Promise<number[]>((resolve) => {
          const visibleCounts: number[] = [];
          function sample() {
            visibleCounts.push([...document.querySelectorAll(".settings-panel")].filter((panel) => panel.getBoundingClientRect().height > 0).length);
            if (visibleCounts.length < 15) requestAnimationFrame(sample);
            else resolve(visibleCounts);
          }
          requestAnimationFrame(sample);
        }));
        await page.getByRole("tab", { name, exact: true }).click();
        expect(await frames).toEqual(Array(15).fill(1));
        const panel = page.getByRole("tabpanel", { name, exact: true });
        await expect(panel).toBeVisible();
        await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBe(0);
        expect(await panel.evaluate((element) => {
          const style = getComputedStyle(element);
          return { transform: style.transform, opacity: style.opacity, animations: element.getAnimations().length };
        })).toEqual({ transform: "none", opacity: "1", animations: 0 });
      }
      const general = page.getByRole("tab", { name: "General", exact: true });
      await general.focus();
      await page.keyboard.press(width < 768 ? "ArrowRight" : "ArrowDown");
      await expect(page.getByRole("tab", { name: "Storage & backups", exact: true })).toBeFocused();
      await expect(page.getByRole("tabpanel", { name: "Storage & backups", exact: true })).toBeVisible();
    }
  }
});

test("settings animates through intermediate frames without dimming and settles on the last tab", async ({ page }) => {
  await page.goto("/settings");
  test.skip(!await page.evaluate(() => !!document.startViewTransition), "Browser has no view transition support");
  await page.evaluate(() => {
    const frames: { oldDuration: string; newDuration: string; groupAnimation: string; objectFit: string; blend: string; samples: { opacity: number; sum: number; x: number; y: number; selectionY: number }[] }[] = [];
    Reflect.set(window, "settingsTransitionFrames", frames);
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = (update) => {
      const transition = start(update);
      void transition.ready.then(() => {
        const frame = {
          oldDuration: getComputedStyle(document.documentElement, "::view-transition-old(settings-content)").animationDuration,
          newDuration: getComputedStyle(document.documentElement, "::view-transition-new(settings-content)").animationDuration,
          groupAnimation: getComputedStyle(document.documentElement, "::view-transition-group(settings-content)").animationName,
          objectFit: getComputedStyle(document.documentElement, "::view-transition-new(settings-content)").objectFit,
          blend: getComputedStyle(document.documentElement, "::view-transition-new(settings-content)").mixBlendMode,
          samples: [] as { opacity: number; sum: number; x: number; y: number; selectionY: number }[],
        };
        frames.push(frame);
        let finished = false;
        void transition.finished.then(() => { finished = true; }, () => { finished = true; });
        function sample() {
          if (finished) return;
          const entering = getComputedStyle(document.documentElement, "::view-transition-new(settings-content)");
          const leaving = getComputedStyle(document.documentElement, "::view-transition-old(settings-content)");
          const matrix = new DOMMatrixReadOnly(entering.transform);
          const selection = new DOMMatrixReadOnly(getComputedStyle(document.documentElement, "::view-transition-group(settings-selection)").transform);
          frame.samples.push({ opacity: Number(entering.opacity), sum: Number(entering.opacity) + Number(leaving.opacity), x: matrix.m41, y: matrix.m42, selectionY: selection.m42 });
          requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      }, () => {});
      return transition;
    };
  });
  await page.getByRole("tab", { name: "Storage & backups", exact: true }).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "settingsTransitionFrames").length)).toBe(1);
  await expect.poll(() => page.getByTestId("settings-content").evaluate((element) => element.style.viewTransitionName)).toBe("");
  const first = await page.evaluate(() => Reflect.get(window, "settingsTransitionFrames")[0]);
  expect(first).toMatchObject({
    oldDuration: "0.26s", newDuration: "0.26s", groupAnimation: "none", objectFit: "none", blend: "plus-lighter",
  });
  expect(first.samples.filter((sample: { opacity: number; y: number }) => sample.opacity > 0.1 && sample.opacity < 0.9 && sample.y > 1).length).toBeGreaterThan(2);
  const selectionPositions = first.samples.filter((sample: { opacity: number }) => sample.opacity > 0 && sample.opacity < 1).map((sample: { selectionY: number }) => sample.selectionY);
  expect(Math.max(...selectionPositions) - Math.min(...selectionPositions)).toBeGreaterThan(10);
  for (const sample of first.samples.filter((sample: { opacity: number }) => sample.opacity > 0 && sample.opacity < 1)) {
    expect(Math.abs(sample.sum - 1)).toBeLessThan(0.01);
  }
  for (const name of ["Installation", "General", "Storage & backups", "Installation"]) {
    await page.getByRole("tab", { name, exact: true }).click();
  }
  await expect(page.getByRole("tabpanel", { name: "Installation", exact: true })).toBeVisible();
  await expect.poll(() => page.getByTestId("settings-content").evaluate((element) => element.style.viewTransitionName)).toBe("");
  const transitionCount = await page.evaluate(() => Reflect.get(window, "settingsTransitionFrames").length);
  await page.getByRole("tab", { name: "Installation", exact: true }).focus();
  await page.keyboard.press("Home");
  await expect(page.getByRole("tabpanel", { name: "General", exact: true })).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, "settingsTransitionFrames").length)).toBe(transitionCount);

  await page.setViewportSize({ width: 320, height: 825 });
  await expect(page.getByRole("tablist", { name: "Settings", exact: true })).toHaveAttribute("data-orientation", "horizontal");
  for (const name of ["Storage & backups", "General"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.getByRole("tabpanel", { name, exact: true })).toBeVisible();
    await expect.poll(() => page.getByTestId("settings-content").evaluate((element) => element.style.viewTransitionName)).toBe("");
    const samples = await page.evaluate(() => Reflect.get(window, "settingsTransitionFrames").at(-1).samples);
    expect(samples.some((sample: { opacity: number; x: number; y: number }) => sample.opacity > 0.1 && sample.opacity < 0.9 && sample.y === 0 && (name === "General" ? sample.x < -1 : sample.x > 1))).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("tab", { name: "Storage & backups", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "Storage & backups", exact: true })).toBeVisible();
  await expect.poll(() => page.getByTestId("settings-content").evaluate((element) => element.style.viewTransitionName)).toBe("");
  const reduced = await page.evaluate(() => Reflect.get(window, "settingsTransitionFrames").at(-1));
  expect(reduced.newDuration).toBe("0.12s");
  expect(reduced.samples.every((sample: { x: number; y: number }) => sample.x === 0 && sample.y === 0)).toBe(true);
});

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
      const main = page.getByRole("main");
      const viewport = main.locator('[data-slot="scroll-area-viewport"]').first();
      const dimensions = await main.evaluate((main) => ({
        viewport: window.innerHeight,
        documentHeight: document.documentElement.scrollHeight,
        mainBottom: main.getBoundingClientRect().bottom,
        scrollAreas: [...document.querySelectorAll("*")].filter((element) => {
          const style = getComputedStyle(element);
          return ["auto", "scroll"].includes(style.overflowY) && element.clientHeight > 0 &&
            element.scrollHeight > element.clientHeight + 1;
        }).length,
      }));
      expect(dimensions.mainBottom).toBeLessThanOrEqual(dimensions.viewport + 1);
      expect(dimensions.documentHeight).toBeLessThanOrEqual(dimensions.viewport + 1);
      expect(dimensions.scrollAreas).toBe(1);
      expect(await viewport.evaluate((element) =>
        element.scrollHeight > element.clientHeight && ["auto", "scroll"].includes(getComputedStyle(element).overflowY)
      )).toBe(true);
      expect(await page.getByTestId("settings-content").evaluate((content) =>
        content.scrollHeight <= content.clientHeight + 1 && getComputedStyle(content).overflowY === "visible"
      )).toBe(true);
      await viewport.evaluate((element) => { element.scrollTop = element.scrollHeight; });
      await expect(page.getByRole("heading", { name: "Settings", exact: true })).not.toBeInViewport();
      await expect(page.getByRole("tablist", { name: "Settings", exact: true })).toBeInViewport();
      await expect(page.getByRole("link", { name: "Help & guides", exact: true })).toBeInViewport();
      if (await page.evaluate(() => "showDirectoryPicker" in window)) {
        await expect(page.getByRole("button", { name: "Choose backup folder", exact: true })).toBeInViewport();
      } else {
        await expect(page.getByText("Folder backups are not supported in this browser.", { exact: false })).toBeInViewport();
      }
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
  await page.getByRole("button", { name: "Save first item", exact: true }).click();
  await page.getByRole("button", { name: "Bulk import", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Bulk import", exact: true }).getByRole("button", { name: "Import browser bookmarks", exact: true })).toBeVisible();
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
      expect(await page.getByRole("main").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: testInfo.outputPath(`settings-${width}-${theme}.png`) });
      await page.keyboard.press("End");
      await expect(page.getByRole("tabpanel", { name: "Installation", exact: true })).toBeVisible();
      await page.keyboard.press("Home");
      await expect(page.getByRole("tabpanel", { name: "General", exact: true })).toBeVisible();
    }
  }
});
