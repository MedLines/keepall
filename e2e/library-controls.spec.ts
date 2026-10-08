import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Start your library", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const blob = await (await fetch("/marketing/capture-image-demo.webm")).blob();
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction(["items", "tags", "videoAssets"], "readwrite");
    const common = { tagIds: ["tag-0"], collectionIds: [], createdAt: 1, updatedAt: 1 };
    tx.objectStore("items").put({ ...common, id: "controls-note", type: "note", title: "Control note", content: "Saved text", format: "plain" });
    tx.objectStore("items").put({ ...common, id: "controls-link", type: "link", title: "Control link", url: "https://example.com", description: "", previewStatus: "failed" });
    tx.objectStore("items").put({ ...common, id: "controls-image", type: "image", title: "Control image", assetIds: [], caption: "", sourceUrl: "" });
    tx.objectStore("items").put({ ...common, id: "controls-video", type: "video", title: "Control video", assetId: "controls-video", sourceFileName: "original-recording.webm", noteContent: "" });
    tx.objectStore("videoAssets").put({ id: "controls-video", blob, mimeType: blob.type, byteLength: blob.size, createdAt: 1 });
    ["Design", "Reading", "Animation", "Canvas", "Charts", "Work", "Personal", "Reference", "Landing page", "Recreate"].forEach((name, index) => {
      tx.objectStore("tags").put({ id: `tag-${index}`, name, createdAt: index });
    });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  });
  await page.reload();
  await expect(page.locator(".library-card")).toHaveCount(4);
});

test("multiple type selections stay open, show icons, and survive reload", async ({ page }, testInfo) => {
  const filter = page.getByRole("combobox", { name: /^Filter by type:/ });
  const originalWidth = (await filter.boundingBox())!.width;
  await filter.click();
  const list = page.getByRole("listbox", { name: "Filter by type" });
  await list.getByRole("option", { name: /Images/ }).click();
  await expect(list).toBeVisible();
  await list.getByRole("option", { name: /Videos/ }).click();
  await list.getByRole("option", { name: /Links/ }).click();
  await expect(page).toHaveURL(/type=image%2Cvideo%2Clink/);
  await expect(filter).toHaveAccessibleName("Filter by type: Images, Videos, Links");
  await expect(filter.locator("svg")).toHaveCount(3);
  expect((await filter.boundingBox())!.width).toBeGreaterThan(originalWidth);
  await page.keyboard.press("Escape");
  await expect(filter).toBeFocused();
  await expect(page.locator(".library-card")).toHaveCount(3);
  await expect(page.locator('[data-item-id="controls-note"]')).toHaveCount(0);
  await page.reload();
  await expect(filter).toHaveAccessibleName("Filter by type: Images, Videos, Links");
  await expect(page.locator(".library-card")).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath("multiple-type-filter.png") });
  await filter.click();
  await list.getByRole("option", { name: /Videos/ }).click();
  await expect(page.locator('[data-item-id="controls-video"]')).toHaveCount(0);
  await list.getByRole("option", { name: /All types/ }).click();
  await expect(page).not.toHaveURL(/type=/);
  await expect(filter.locator("svg")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".library-card")).toHaveCount(4);
  await page.setViewportSize({ width: 320, height: 825 });
  const closeNavigation = page.getByRole("button", { name: "Close navigation", exact: true });
  if (await closeNavigation.isVisible()) await closeNavigation.click();
  await filter.click();
  for (const label of ["Images", "Videos", "Links", "Notes", "Documents"]) await list.getByRole("option", { name: new RegExp(label) }).click();
  await expect(filter.locator("svg")).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const bounds = (await list.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: testInfo.outputPath("multiple-type-filter-mobile.png") });
});

test("tag search stays in place while results shrink, expand and create a new tag", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.locator('[data-item-id="controls-note"] .library-card').click({ button: "right" });
  await page.getByRole("menuitem", { name: "Tags", exact: true }).hover();
  const search = page.getByRole("textbox", { name: "Search tags" });
  await expect(search).toBeFocused();
  const before = (await search.boundingBox())!;
  for (const query of ["Reading", "A new tag", "", "Animation"]) {
    await search.fill("");
    for (const character of query) {
      await search.pressSequentially(character);
      await expect(search).toBeFocused();
      await expect.poll(async () => {
        const after = (await search.boundingBox())!;
        return Math.max(Math.abs(after.x - before.x), Math.abs(after.y - before.y));
      }).toBeLessThan(1);
    }
  }
  await search.fill("A new tag");
  await search.press("Enter");
  await expect(page.getByRole("menuitemcheckbox", { name: "A new tag", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(search).toBeFocused();
  const after = (await search.boundingBox())!;
  expect(after.y).toBeCloseTo(before.y, 0);
  await page.screenshot({ path: testInfo.outputPath("stable-tag-search.png") });
});

test("video download saves the original file", async ({ page }) => {
  await page.goto("/items/controls-video");
  const download = page.getByRole("link", { name: "Download video", exact: true });
  await expect(download).toBeVisible();
  const pending = page.waitForEvent("download");
  await download.click();
  const saved = await pending;
  expect(saved.suggestedFilename()).toBe("original-recording.webm");
  expect(await saved.failure()).toBeNull();
});
