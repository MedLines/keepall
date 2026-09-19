import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  // Each Playwright test has its own browser context and database.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["collections", "items"], "readwrite");
        for (const [id, name] of [["design", "Design Inspiration"], ["reading", "Reading"]]) {
          tx.objectStore("collections").put({ id, name, createdAt: 1, pinnedItemIds: [] });
          tx.objectStore("items").put({
            id: `${id}-note`, type: "note", title: `${name} note`,
            content: `${name} test content`, collectionIds: [id], tagIds: [],
            createdAt: 1, updatedAt: 1,
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
  await expect(page.getByRole("complementary", { name: "Sidebar" }).getByRole("button", { name: "Design Inspiration", exact: true })).toBeVisible();
});

async function expectCollection(page: Page, name: string, other: string) {
  await expect(page.getByRole("complementary", { name: "Sidebar" }).getByRole("button", { name, exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("main").getByText(`${name} test content`, { exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByText(`${other} test content`, { exact: true })).toBeHidden();
}

test("collection heading uses free space before truncating", async ({ page }) => {
  await page.setViewportSize({ width: 1707, height: 825 });
  await page.getByRole("complementary", { name: "Sidebar" }).getByRole("button", { name: "Design Inspiration", exact: true }).click();
  const heading = page.locator("#library-heading");
  await expect(heading).toHaveText("Design Inspiration");
  await expect(heading.locator("..")).toHaveCSS("max-width", "none");
  expect(await heading.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 768, height: 825 });
  await expect(page.getByRole("button", { name: "Sort library" })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const edge of ["top", "centre", "bottom", "left"] as const) {
  test(`collection navigation works at the row ${edge}`, async ({ page }) => {
    const button = page.getByRole("complementary", { name: "Sidebar" }).getByRole("button", { name: "Design Inspiration", exact: true });
    const row = button.locator("..");
    await row.scrollIntoViewIfNeeded();
    const bounds = await row.boundingBox();
    if (!bounds) throw new Error("Collection row has no layout box");
    const x = bounds.x + (edge === "left" ? 2 : bounds.width / 2);
    const y = bounds.y + (edge === "top" ? 2 : edge === "bottom" ? bounds.height - 2 : bounds.height / 2);
    // Coordinates deliberately cover the painted row, not just the button centre.
    await page.mouse.click(x, y);
    await expectCollection(page, "Design Inspiration", "Reading");
  });
}

test("collection actions do not navigate and keyboard navigation still works", async ({ page }) => {
  const sidebar = page.getByRole("complementary", { name: "Sidebar" });
  const design = sidebar.getByRole("button", { name: "Design Inspiration", exact: true });
  await design.click();
  const reading = sidebar.getByRole("button", { name: "Reading", exact: true });
  await reading.hover();
  await page.getByRole("button", { name: "Reading actions", exact: true }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await expectCollection(page, "Design Inspiration", "Reading");
  await page.keyboard.press("Escape");
  await reading.focus();
  await page.keyboard.press("Enter");
  await expectCollection(page, "Reading", "Design Inspiration");
});

test("rapid row-edge switches leave the last collection selected", async ({ page }) => {
  for (let i = 0; i < 12; i++) {
    const name = i % 2 === 0 ? "Design Inspiration" : "Reading";
    const row = page.getByRole("complementary", { name: "Sidebar" }).getByRole("button", { name, exact: true }).locator("..");
    const bounds = await row.boundingBox();
    if (!bounds) throw new Error("Collection row has no layout box");
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + (i % 2 === 0 ? 2 : bounds.height - 2));
  }
  await expectCollection(page, "Reading", "Design Inspiration");
  // The delayed URL write must preserve the final selection too.
  await expect(page).toHaveURL(/collection=reading/);
});
