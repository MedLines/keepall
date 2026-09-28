import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block", viewport: { width: 1440, height: 900 } });

async function dragEdge(page: Page, x: number) {
  const handle = page.getByRole("separator", { name: "Resize sidebar" });
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
}

test("sidebar resizes within limits, remembers width, and drags into and out of its rail", async ({ page }) => {
  await page.goto("/");
  const sidebar = page.getByRole("complementary", { name: "Sidebar" });
  const handle = page.getByRole("separator", { name: "Resize sidebar" });
  await expect(handle).toBeVisible();
  await dragEdge(page, 330);
  await expect(sidebar).toHaveCSS("width", "330px");
  await page.reload();
  await expect(sidebar).toHaveCSS("width", "330px");
  await dragEdge(page, 650);
  await expect(sidebar).toHaveCSS("width", "400px");
  await dragEdge(page, 80);
  await expect(sidebar).toHaveCSS("width", "56px");
  await page.reload();
  await expect(sidebar).toHaveCSS("width", "56px");
  await dragEdge(page, 300);
  await expect(sidebar).toHaveCSS("width", "300px");
  await expect(sidebar.getByRole("link", { name: "Settings", exact: true })).toBeVisible();
  await handle.focus();
  await page.keyboard.press("Home");
  await expect(sidebar).toHaveCSS("width", "56px");
  await page.keyboard.press("ArrowRight");
  await expect(sidebar).toHaveCSS("width", "300px");
  await page.keyboard.press("End");
  await expect(sidebar).toHaveCSS("width", "400px");
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(sidebar).toHaveCSS("width", "320px");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(handle).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Escape cancels a resize and width is saved only on release", async ({ page }) => {
  await page.goto("/");
  const sidebar = page.getByRole("complementary", { name: "Sidebar" });
  const handle = page.getByRole("separator", { name: "Resize sidebar" });
  await expect(handle).toBeVisible();
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, 350);
  await page.mouse.down();
  await page.mouse.move(360, 350, { steps: 8 });
  await expect(sidebar).toHaveCSS("width", "360px");
  expect(await page.evaluate(() => localStorage.getItem("keepall-shell-sidebar-width"))).toBeNull();
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(sidebar).toHaveCSS("width", "256px");
  expect(await page.evaluate(() => document.documentElement.hasAttribute("data-sidebar-resizing"))).toBe(false);
  expect(await page.locator("[data-library-panel]").evaluate(element => element.getAttribute("style") ?? "")).not.toContain("--library-resize-width");
});

test("changing to a phone viewport releases an unfinished drag's layout lock", async ({ page }) => {
  await page.goto("/");
  const handle = page.getByRole("separator", { name: "Resize sidebar" });
  await expect(handle).toBeVisible();
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, 350);
  await page.mouse.down();
  await page.mouse.move(360, 350, { steps: 8 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.mouse.up();
  await expect(handle).toHaveCount(0);
  expect(await page.locator("[data-library-panel]").evaluate(element => element.getAttribute("style") ?? "")).not.toContain("--library-resize-width");
  expect(await page.evaluate(() => document.documentElement.hasAttribute("data-sidebar-resizing"))).toBe(false);
});

test("logo context menu exposes three links and supports keyboard opening", async ({ page }) => {
  await page.goto("/");
  const logo = page.getByRole("link", { name: "Keepall home", exact: true });
  await logo.click({ button: "right" });
  await expect(page.getByRole("menuitem")).toHaveText(["Library homepage", "About", "Help"]);
  await page.keyboard.press("Escape");
  await logo.focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "About", exact: true })).toBeVisible();
  await page.getByRole("menuitem", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await page.goto("/settings");
  await logo.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Help", exact: true }).click();
  await expect(page).toHaveURL(/\/help$/);
});

for (const preference of ["open", "closed"] as const) {
  test(`refresh paints the saved ${preference} sidebar before hydration without animating`, async ({ page }) => {
    await page.addInitScript((state) => {
      localStorage.setItem("keepall-shell-panel-open", state);
      localStorage.setItem("keepall-shell-sidebar-width", "350");
    }, preference);
    let releaseScripts!: () => void;
    const scriptsReady = new Promise<void>(resolve => { releaseScripts = resolve; });
    await page.route("**/*", async route => {
      if (route.request().resourceType() === "script" && route.request().url().includes("/_next/")) {
        await scriptsReady;
      }
      await route.continue();
    });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/", { waitUntil: "commit" });
    const sidebar = page.getByRole("complementary", { name: "Sidebar" });
    const expectedWidth = preference === "open" ? 350 : 56;
    try {
      await expect(sidebar).toBeVisible();
      // The server HTML is painted while the hydration bundles remain blocked.
      await expect(sidebar).toHaveCSS("width", `${expectedWidth}px`);
      await expect(sidebar.locator("[data-sidebar-panel]")).toHaveCSS("transition-duration", "0s");
      await sidebar.evaluate(element => {
        const samples: { widths: number[]; clips: string[] } = { widths: [], clips: [] };
        (window as unknown as { sidebarStartup: typeof samples }).sidebarStartup = samples;
        const until = performance.now() + 2500;
        function sample() {
          samples.widths.push(element.getBoundingClientRect().width);
          samples.clips.push(getComputedStyle(element.querySelector("[data-sidebar-panel]")!).clipPath);
          if (performance.now() < until) requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
    } finally {
      releaseScripts();
    }
    await page.waitForLoadState("load");
    await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
    await page.waitForTimeout(400);
    const samples = await page.evaluate(() => (window as unknown as { sidebarStartup: { widths: number[]; clips: string[] } }).sidebarStartup);
    expect(samples.widths.length).toBeGreaterThan(2);
    expect([...new Set(samples.widths)]).toEqual([expectedWidth]);
    expect(new Set(samples.clips).size).toBe(1);
    expect(errors).toEqual([]);
  });
}
