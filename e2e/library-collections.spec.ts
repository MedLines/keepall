import { expect, test } from "@playwright/test";

test("collection folders preview recent items, lift on hover, and open their collection", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Start your library", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 180;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "oklch(0.810944794 0.021439736 181.732278626)";
    ctx.fillRect(0, 0, 200, 180);
    ctx.fillStyle = "oklch(0.548540852 0.03421723 177.9495173)";
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
          id: "reading-link", type: "link", title: "Research notes", url: "https://example.org/research", previewStatus: "failed", previewRetry: "none", previewTitle: "", previewDescription: "", previewImageUrl: "", previewAssetId: null, previewAttemptedAt: 1, collectionIds: ["reading"], tagIds: [], createdAt: 1, updatedAt: 1,
        });
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
  await expect(design.locator(".collection-folder-preview-title")).toHaveText(["Idea 4", "Idea 3"]);
  await expect(design.locator('.collection-folder-preview[data-type="image"]')).not.toHaveText('Mountain study');
  await expect(design.locator('.collection-folder-text-preview svg')).toHaveCount(2);
  await expect(design).not.toContainText('Keep a little room for the unexpected.');
  await expect(design.locator("img")).toBeVisible();
  await expect(design.locator("img")).toHaveCSS("outline-style", "solid");
  await expect(design.locator("img")).toHaveCSS("border-top-width", "0px");
  await expect(design.locator('.collection-folder-preview-header')).toHaveCount(0);
  await expect(design.locator('.collection-folder-type')).toHaveCount(2);
  await expect(design.locator('.collection-folder-type[data-type="note"] svg')).toBeVisible();
  await expect(design.locator('.collection-folder-type[data-type="image"] svg')).toBeVisible();
  await expect(folders.getByRole('link', { name: 'Open Someday, 0 items' }).locator('.collection-folder-types')).toHaveCount(0);
  await expect(design.locator('.collection-folder-item-card').first().locator(':scope > :first-child')).toHaveClass('collection-folder-media');
  const backgroundBefore = await design.evaluate(element => getComputedStyle(element).backgroundColor);
  const preview = design.locator(".collection-folder-preview").first();
  const front = design.locator(".collection-folder-front");
  await page.mouse.move(0, 0);
  for (const innerCard of await design.locator('.collection-folder-item-card').all()) {
    await expect(innerCard).toHaveCSS('background-color', 'oklch(0.984548 0.00263721 106.448)');
  }
  for (const content of await folders.locator('.collection-folder-text-preview').all()) {
    await expect(content).toHaveCSS('background-color', 'oklch(0.22645 0.00003 271.152)');
    await expect(content).toHaveCSS('border-top-left-radius', '16px');
    await expect(content).toHaveCSS('color', 'oklch(1 0 0)');
    await expect(content.locator('svg')).toHaveCSS('color', 'oklch(1 0 0)');
  }
  await page.screenshot({ path: testInfo.outputPath('collections-rest-light.png'), fullPage: true });
  const stage = (await design.locator('.collection-folder-stage').boundingBox())!;
  const rest = await preview.boundingBox();
  expect(rest!.y - stage.y).toBeLessThan(50);
  const frontTop = await design.locator('.collection-folder-front-surface').evaluate(element => element.getBoundingClientRect().y);
  // Each resting preview exposes content above the closed front.
  for (const tile of await design.locator('.collection-folder-preview').all()) {
    expect((await tile.boundingBox())!.y + 8).toBeLessThan(frontTop);
  }
  const frontRest = await front.boundingBox();
  const leftPreview = design.locator('.collection-folder-preview[data-position="left"]');
  const leftRest = await leftPreview.boundingBox();
  const rightPreview = design.locator('.collection-folder-preview[data-position="right"]');
  const rightRest = await rightPreview.boundingBox();
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await design.hover();
  const midOpening = await design.locator('.collection-folder-gradient-top').evaluate(element => {
    const front = element.closest('.collection-folder-front')!;
    const animations = front.getAnimations({ subtree: true });
    for (const animation of animations) { animation.pause(); animation.currentTime = 130; }
    const state = { opacity: Number(getComputedStyle(element).stopOpacity), transform: getComputedStyle(front).transform };
    for (const animation of animations) animation.play();
    return state;
  });
  expect(midOpening.opacity).toBeGreaterThan(0.86);
  expect(midOpening.opacity).toBeLessThan(1);
  expect(midOpening.transform).not.toBe('none');
  await expect.poll(async () => (await preview.boundingBox())!.y).toBeLessThan(rest!.y - 38);
  await expect.poll(async () => (await leftPreview.boundingBox())!.x).toBeLessThan(leftRest!.x - 30);
  await expect.poll(async () => (await rightPreview.boundingBox())!.x).toBeGreaterThan(rightRest!.x + 30);
  await expect.poll(async () => (await front.boundingBox())!.width).toBeGreaterThan(frontRest!.width + 10);
  await expect(design).toHaveCSS('background-color', backgroundBefore);
  await expect(design.locator('.collection-folder-gradient-top')).toHaveCSS('stop-opacity', '0.86');
  await expect(design.locator('.collection-folder-gradient-middle')).toHaveCSS('stop-opacity', '0.97');
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
  await expect.poll(async () => (await preview.boundingBox())!.y).toBeLessThan(rest!.y - 38);
  await expect(design.locator('.collection-folder-gradient-bottom')).toHaveCSS('stop-opacity', '1');
  await expect(design.locator('.collection-folder-gradient-bottom')).toHaveCSS('stop-color', 'oklch(0.699261 0 0)');
  await page.screenshot({ path: testInfo.outputPath('collections-glass-light.png'), fullPage: true });
  if (await page.locator("html").getAttribute("data-theme") !== "dark") await page.getByRole("button", { name: "Theme", exact: true }).click();
  await page.mouse.move(0, 0);
  await expect(design.locator('.collection-folder-gradient-top')).toHaveCSS('stop-opacity', '1');
  const notePaper = design.locator('.collection-folder-preview[data-type="note"] .collection-folder-item-card').first();
  const linkCard = folders.getByRole('link', { name: 'Open Reading, 1 item', exact: true }).locator('.collection-folder-item-card');
  for (const innerCard of await design.locator('.collection-folder-item-card').all()) {
    await expect(innerCard).toHaveCSS('background-color', 'oklch(0.50676 0.00006 271.152)');
  }
  await expect(notePaper.locator('.collection-folder-text-preview')).toHaveCSS('background-color', 'oklch(0.22645 0.00003 271.152)');
  await expect(linkCard.locator('.collection-folder-text-preview')).toHaveCSS('background-color', 'oklch(0.22645 0.00003 271.152)');
  const textPairs = await page.locator('.collection-folder-preview-title').evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element);
    const surface = element.closest('.collection-folder-text-preview')!;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d')!;
    const toRgb = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
      return `rgb(${r}, ${g}, ${b})`;
    };
    return { text: toRgb(style.color), background: toRgb(getComputedStyle(surface).backgroundColor) };
  }));
  for (const pair of textPairs) {
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
        const srgb = value / 255;
        return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const background = luminance(pair.background);
    const text = luminance(pair.text);
    expect((Math.max(background, text) + 0.05) / (Math.min(background, text) + 0.05)).toBeGreaterThan(4.5);
  }
  await page.screenshot({ path: testInfo.outputPath('collections-rest-dark.png'), fullPage: true });
  await design.hover();
  await expect.poll(async () => (await preview.boundingBox())!.y).toBeLessThan(rest!.y - 38);
  await expect.poll(async () => (await front.boundingBox())!.width).toBeGreaterThan(frontRest!.width + 10);
  await page.screenshot({ path: testInfo.outputPath("collections-dark.png"), fullPage: true });
  await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await session.detach();

  const selection = card.getByRole('checkbox', { name: 'Select Design Inspiration', exact: true });
  await card.locator('label').click();
  await expect(selection).toBeChecked();
  await expect(selection).toBeFocused();
  await page.mouse.move(0, 0);
  await expect(design.locator('.collection-folder-gradient-top')).toHaveCSS('stop-opacity', '1');
  await expect(front).toHaveCSS('transform', 'none');
  await expect.poll(async () => (await preview.boundingBox())!.y).toBeCloseTo(rest!.y, 1);
  await card.locator('label').click();
  await expect(selection).not.toBeChecked();

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
    await card.scrollIntoViewIfNeeded();
    await design.hover();
    await expect(design.locator('.collection-folder-gradient-top')).toHaveCSS('stop-opacity', '0.86');
    await design.evaluate(element => { element.closest('[data-slot="scroll-area-viewport"]')!.scrollTop = 0; });
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
