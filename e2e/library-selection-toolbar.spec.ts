import { expect, test } from "@playwright/test";

test("selection actions stay beside Search without shifting library content", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("items", "readwrite");
        for (let index = 1; index <= 2; index++) {
          tx.objectStore("items").put({
            id: `toolbar-${index}`, type: "note", title: `Toolbar note ${index}`,
            content: `needle searchable record ${index}`, collectionIds: [], tagIds: [],
            createdAt: index, updatedAt: index,
          });
        }
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  });
  await page.reload();
  const search = page.getByRole("searchbox", { name: "Search" });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Expand", exact: true })).toBeVisible();
  await search.fill("needle");
  await expect(page.getByRole("heading", { name: "All items" })).toBeVisible();
  await expect(page.locator(".library-card")).toHaveCount(2);
  const activeFilters = page.getByRole("group", { name: "Active filters" });
  await expect(activeFilters.getByRole("button", { name: /Remove search filter: needle/ })).toBeVisible();

  const header = page.locator("header").filter({ has: page.locator("#library-heading") });
  const firstCard = page.locator(".library-card").first();
  const heading = page.getByRole("heading", { name: "All items" });
  const menuTrigger = page.getByRole("button", { name: "Selection actions: 1 selected" });

  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(heading).toBeVisible();
    await expect(search).toBeVisible();
    await expect(activeFilters.getByRole("button", { name: /Remove search filter: needle/ })).toBeVisible();
    const headerBefore = (await header.boundingBox())!;
    const cardBefore = (await firstCard.boundingBox())!;

    if (!(await menuTrigger.isVisible())) {
      await firstCard.getByRole("checkbox").focus();
      await page.keyboard.press("Space");
    }
    await expect(menuTrigger).toBeVisible();
    const headerAfter = (await header.boundingBox())!;
    const cardAfter = (await firstCard.boundingBox())!;
    const searchBox = (await search.boundingBox())!;
    const toolbarBox = (await menuTrigger.boundingBox())!;
    expect(Math.abs(headerAfter.height - headerBefore.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(cardAfter.y - cardBefore.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(searchBox.y - toolbarBox.y)).toBeLessThanOrEqual(1);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    if (width !== 1440) {
      await menuTrigger.click();
      await page.getByRole("menuitem", { name: "Deselect all", exact: true }).click();
      await expect(page.getByRole("region", { name: "Bulk actions" })).toHaveCount(0);
      await expect(search).toBeFocused();
    }
  }

  await menuTrigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Organize", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menuTrigger).toBeFocused();
  await expect(page.getByRole("region", { name: "Bulk actions" })).toContainText("1 selected");

  await menuTrigger.click();
  await page.getByRole("menuitem", { name: "Organize", exact: true }).click();
  const organizeDialog = page.getByRole("dialog", { name: "Organize 1 selected item", exact: true });
  await expect(organizeDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(organizeDialog).toBeHidden();

  await menuTrigger.click();
  await page.getByRole("menuitem", { name: "Move to Trash", exact: true }).click();
  const trashDialog = page.getByRole("dialog", { name: "Move 1 selected item to Trash", exact: true });
  await expect(trashDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trashDialog).toBeHidden();

  await menuTrigger.click();
  await page.getByRole("menuitem", { name: "Deselect all", exact: true }).click();
  await expect(page.getByRole("region", { name: "Bulk actions" })).toHaveCount(0);
  await expect(search).toBeFocused();
});
