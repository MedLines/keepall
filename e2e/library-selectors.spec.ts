import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("library selectors support tab, arrow, home/end, selection, and Escape", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();

  const typeFilter = page.getByRole("combobox", { name: /^Filter by type: All types$/ });
  const sort = page.getByRole("combobox", { name: /^Sort library: Newest first$/ });

  await typeFilter.focus();
  await page.keyboard.press("Tab");
  await expect(sort).toBeFocused();
  await page.keyboard.press("Enter");

  const sortList = page.getByRole("listbox", { name: "Sort library" });
  const newest = sortList.getByRole("option", { name: "Newest first" });
  const oldest = sortList.getByRole("option", { name: "Oldest first" });
  await expect(newest).toHaveAttribute("data-highlighted", "");
  await page.keyboard.press("End");
  await expect(oldest).toHaveAttribute("data-highlighted", "");
  await page.keyboard.press("Home");
  await expect(newest).toHaveAttribute("data-highlighted", "");
  await page.keyboard.press("Escape");
  await expect(sortList).toHaveCount(0);
  await expect(sort).toBeFocused();

  await typeFilter.focus();
  await page.keyboard.press("Space");
  const typeList = page.getByRole("listbox", { name: "Filter by type" });
  const allTypes = typeList.getByRole("option", { name: /All types/ });
  const images = typeList.getByRole("option", { name: /Images/ });
  await expect(allTypes).toHaveAttribute("aria-selected", "true");
  await expect(allTypes).toHaveAttribute("data-highlighted", "");

  await page.keyboard.press("ArrowDown");
  await expect(images).toHaveAttribute("data-highlighted", "");
  await page.keyboard.press("ArrowUp");
  await expect(allTypes).toHaveAttribute("data-highlighted", "");
  await page.keyboard.press("ArrowDown");
  await expect(images).toHaveAttribute("data-highlighted", "");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/type=image/);
  const selectedFilter = page.getByRole("combobox", { name: /^Filter by type: Images$/ });
  await expect(selectedFilter).toBeFocused();
  await expect(selectedFilter).toHaveAttribute("title", "Filter by type: Images");
});

test("selector popup stays inside a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();

  const sort = page.getByRole("combobox", { name: /^Sort library:/ });
  await sort.focus();
  await page.keyboard.press("Enter");

  const popup = page.getByRole("listbox", { name: "Sort library" }).locator("..");
  await expect(popup).toBeVisible();
  const bounds = (await popup.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
});
