import { expect, test } from "@playwright/test";

test("collection folders preview recent items, lift on hover, and open their collection", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 180;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#b3c6c2";
    ctx.fillRect(0, 0, 200, 180);
    ctx.fillStyle = "#5c7871";
    ctx.beginPath();
    ctx.moveTo(0, 180);
    ctx.lineTo(110, 35);
    ctx.lineTo(200, 180);
    ctx.fill();
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), "image/png"));
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["collections", "items", "thumbnails"], "readwrite");
        for (const [id, name] of [["design", "Design Inspiration"], ["reading", "Reading"], ["empty", "Someday"], ["long", "Ideas for a slower, more thoughtful everyday life"]]) {
          tx.objectStore("collections").put({ id, name, createdAt: 1, pinnedItemIds: [] });
        }
        for (let index = 1; index <= 4; index++) {
          tx.objectStore("items").put({
            id: `note-${index}`, type: "note", title: `Idea ${index}`, content: `Keep a little room for the unexpected. Note ${index}.`,
            collectionIds: ["design"], tagIds: [], createdAt: index, updatedAt: index,
          });
        }
        tx.objectStore("items").put({
          id: "image", type: "image", title: "Mountain study", caption: "", sourceUrl: "", assetIds: ["mountain"],
          collectionIds: ["design"], tagIds: [], createdAt: 5, updatedAt: 5,
        });
        tx.objectStore("thumbnails").put({ assetId: "mountain", blob });
        tx.objectStore("items").put({
          id: "trashed", type: "note", title: "Deleted", content: "Deleted note",
          collectionIds: ["design"], tagIds: [], createdAt: 10, updatedAt: 10, deletedAt: 11,
        });
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  });
  await page.reload();
  await page.getByRole("button", { name: "All collections", exact: true }).click();
  await expect(page).toHaveURL(/collections=1/);
  const folders = page.getByRole("list", { name: "Library collections" });
  const design = folders.getByRole("link", { name: "Open Design Inspiration, 5 items", exact: true });
  await expect(design).toBeVisible();
  await expect(folders.getByRole("link", { name: "Open Someday, 0 items" })).toBeVisible();
  await expect(design.locator(".collection-folder-preview")).toHaveCount(3);
  await expect(design.locator(".collection-folder-preview-title")).toHaveText(["Mountain study", "Idea 4", "Idea 3"]);
  await expect(design.locator("img")).toBeVisible();
  await expect(design.locator("img")).toHaveCSS("outline-style", "none");
  await expect(design.locator("img")).toHaveCSS("border-top-width", "0px");
  await expect(design.locator('.collection-folder-types, .collection-folder-preview-header')).toHaveCount(0);
  await expect(design.locator('.collection-folder-item-card').first().locator(':scope > :first-child')).toHaveClass('collection-folder-media');
  const backgroundBefore = await design.evaluate(element => getComputedStyle(element).backgroundColor);
  const preview = design.locator(".collection-folder-preview").first();
  const front = design.locator(".collection-folder-front");
  const rest = await preview.boundingBox();
  const frontRest = await front.boundingBox();
  const rightPreview = design.locator(".collection-folder-preview").nth(1);
  const rightRest = await rightPreview.boundingBox();
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await design.hover();
  await expect.poll(async () => (await preview.boundingBox())!.y).toBeLessThan(rest!.y - 50);
  await expect.poll(async () => (await preview.boundingBox())!.x).toBeLessThan(rest!.x - 30);
  await expect.poll(async () => (await rightPreview.boundingBox())!.x).toBeGreaterThan(rightRest!.x + 30);
  await expect.poll(async () => (await front.boundingBox())!.width).toBeGreaterThan(frontRest!.width + 10);
  await expect(design).toHaveCSS('background-color', backgroundBefore);
  await expect(design.locator('.collection-folder-front-glass')).toHaveCSS('opacity', '1');
  await expect(design.locator('.collection-folder-front-solid')).toHaveCSS('opacity', '0');
  await expect(design.locator('.collection-folder-front')).toHaveCSS('filter', 'none');
  await expect(design.locator('.collection-folder-front')).toHaveCSS('backdrop-filter', 'none');
  const scrollTop = (await page.getByRole('main').boundingBox())!.y;
  for (const tile of await design.locator('.collection-folder-preview').all()) {
    expect((await tile.boundingBox())!.y).toBeGreaterThan(scrollTop + 4);
  }
  const card = design.locator('..');
  for (const control of [card.locator('label'), card.getByRole('button', { name: 'Design Inspiration actions', exact: true })]) {
    const controlBox = (await control.boundingBox())!;
    expect(controlBox.y).toBeGreaterThan(scrollTop + 4);
    for (const tile of await design.locator('.collection-folder-preview').all()) {
      expect(controlBox.y + controlBox.height + 8).toBeLessThan((await tile.boundingBox())!.y);
    }
  }
  await card.getByRole('button', { name: 'Design Inspiration actions', exact: true }).hover();
  await expect.poll(async () => (await preview.boundingBox())!.y).toBeLessThan(rest!.y - 50);
  await expect(design.locator('.collection-folder-glass-bottom')).toHaveCSS('stop-opacity', '1');
  await page.screenshot({ path: testInfo.outputPath('collections-glass-light.png'), fullPage: true });
  if (await page.locator("html").getAttribute("data-theme") !== "dark") await page.getByRole("button", { name: "Theme", exact: true }).click();
  await design.hover();
  await expect.poll(async () => (await preview.boundingBox())!.y).toBeLessThan(rest!.y - 50);
  await expect.poll(async () => (await front.boundingBox())!.width).toBeGreaterThan(frontRest!.width + 10);
  await page.screenshot({ path: testInfo.outputPath("collections-dark.png"), fullPage: true });
  await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await session.detach();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.mouse.move(0, 0);
  const reducedRest = await preview.boundingBox();
  await design.hover();
  expect((await preview.boundingBox())!.y).toBeCloseTo(reducedRest!.y, 1);
  await expect(front).toHaveCSS("transform", "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await design.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#library-heading")).toHaveText("Design Inspiration");
  await expect(page).toHaveURL(/collection=design/);
  await expect(page.getByRole("group", { name: "Library layout", exact: true })).toBeVisible();
  await page.goBack();
  await expect(folders).toBeVisible();
  await page.reload();
  await expect(folders).toBeVisible();
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("SOMEDAY");
  await expect(folders.getByRole("link", { name: /^Open / })).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("missing");
  await expect(page.getByText("No matching collections.", { exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("");

  for (const width of [768, 320]) {
    await page.setViewportSize({ width, height: 825 });
    const closeNavigation = page.getByRole("button", { name: "Close navigation", exact: true });
    if (width < 768) await closeNavigation.click();
    await expect(design).toBeVisible();
    await design.hover();
    await expect.poll(async () => (await preview.boundingBox())!.y).toBeLessThan((await design.locator('.collection-folder-stage').boundingBox())!.y);
    const mainTop = (await page.getByRole('main').boundingBox())!.y;
    const controlBottoms = await card.locator('label, button.organization-actions').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().bottom));
    for (const tile of await design.locator('.collection-folder-preview').all()) {
      const top = (await tile.boundingBox())!.y;
      expect(top).toBeGreaterThan(mainTop + 4);
      expect(top).toBeGreaterThan(Math.max(...controlBottoms) + 8);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("group", { name: "Library layout", exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("collections-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Expand", exact: true }).click();
  await page.getByRole("button", { name: "All items", exact: true }).click();
  await expect(folders).toBeHidden();
  await expect(page.locator("#library-heading")).toHaveText("All items");
  expect(errors).toEqual([]);
});
