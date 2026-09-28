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
