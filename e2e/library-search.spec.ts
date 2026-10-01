import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("search matches remembered words, highlights them, and preserves best match after reload", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  // Fixtures live only in this test's disposable browser context.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("items", "readwrite");
        const common = { type: "note", updatedAt: 1, collectionIds: [], tagIds: [] };
        for (const item of [
          { id: "patterns", title: "React patterns", content: "Useful animation examples", createdAt: 1 },
          { id: "reference", title: "React reference", content: "Animation glossary", createdAt: 2 },
          { id: "incidental", title: "Scratchpad", content: "React animation", createdAt: 3 },
          { id: "missing", title: "React only", content: "Missing the other term", createdAt: 4 },
        ]) tx.objectStore("items").put({ ...common, ...item });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  });
  await page.reload();
  const search = page.getByRole("searchbox", { name: "Search", exact: true });
  const cards = page.locator(".library-card");
  const ids = () => page.locator(".library-item-root").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-item-id")));
  await search.fill("animation react");
  await expect(cards).toHaveCount(3);
  await expect.poll(ids).toEqual(["incidental", "reference", "patterns"]);
  await expect(cards.filter({ hasText: "React patterns" }).locator("mark").filter({ hasText: /^React$/ }).first()).toBeVisible();
  await expect(cards.filter({ hasText: "React patterns" }).locator("mark").filter({ hasText: /^animation$/ }).first()).toBeVisible();
  await page.getByRole("combobox", { name: "Sort library: Newest first", exact: true }).click();
  await page.getByRole("option", { name: "Best match", exact: true }).click();
  await expect.poll(ids).toEqual(["reference", "patterns", "incidental"]);
  await expect(page).toHaveURL(/sort=relevance/);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Sort library: Best match", exact: true })).toBeVisible();
  await expect.poll(ids).toEqual(["reference", "patterns", "incidental"]);
  await search.fill('react "animation examples"');
  await expect(cards).toHaveCount(1);
  await expect(cards.locator("mark").filter({ hasText: /^animation examples$/ }).first()).toBeVisible();
  await search.fill('"react animation"');
  await expect.poll(ids).toEqual(["incidental"]);
  await search.fill("");
  await expect(cards).toHaveCount(4);
  await expect.poll(ids).toEqual(["missing", "incidental", "reference", "patterns"]);
  await page.getByRole("combobox", { name: "Sort library: Newest first", exact: true }).click();
  await expect(page.getByRole("option", { name: "Best match", exact: true })).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Newest first", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole("button", { name: "Close navigation", exact: true }).click();
  await search.fill("animation react");
  await page.getByRole("combobox", { name: "Sort library: Best match", exact: true }).click();
  const popup = page.getByRole("listbox", { name: "Sort library" }).locator("..");
  const bounds = (await popup.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: testInfo.outputPath("best-match-mobile.png") });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Expand", exact: true }).click();
  await expect.poll(() => page.locator("[data-sidebar-panel]").evaluate(node => getComputedStyle(node).clipPath)).toBe("inset(0px)");
  await page.screenshot({ path: testInfo.outputPath("search-and-sidebar-arrows.png") });
  expect(errors).toEqual([]);
});
