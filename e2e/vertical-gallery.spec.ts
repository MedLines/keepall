import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

test.use({ serviceWorkers: "block" });

async function seedGallery(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Save item", exact: true })).toBeVisible();
  // Each test owns a disposable browser context, never the user's library.
  await page.evaluate(async () => {
    const request = indexedDB.open("keepall");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const assets = await Promise.all(Array.from({ length: 10 }, async (_, index) => {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = index % 3 === 1 ? 500 : 1200;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = ["oklch(0.907238442 0.020052611 77.308684788)", "oklch(0.872405343 0.018586383 161.060208768)", "oklch(0.89207818 0.021224501 271.174151757)"][index % 3];
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "oklch(0.33387358 0.026677417 173.069141888)";
      ctx.font = "24px sans-serif";
      ctx.fillText("DESIGN REFERENCE", 60, 84);
      ctx.font = "bold 72px sans-serif";
      ctx.fillText(`Study ${index + 1}`, 60, 204);
      ctx.fillRect(60, 280, 680, 8);
      ctx.font = "30px sans-serif";
      ctx.fillText("Space to explore.", 60, 360);
      const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!)));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const thumb = document.createElement("canvas");
      thumb.width = 80;
      thumb.height = canvas.height / 10;
      thumb.getContext("2d")!.drawImage(canvas, 0, 0, thumb.width, thumb.height);
      const thumbnail = await new Promise<Blob>(resolve => thumb.toBlob(blob => resolve(blob!)));
      return { id: `gallery-asset-${index}`, bytes, blob: thumbnail };
    }));
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["items", "assets", "thumbnails"], "readwrite");
      for (const { id, bytes, blob } of assets) {
        tx.objectStore("assets").put({ id, bytes, mimeType: "image/png", byteLength: bytes.length, contentHash: id, createdAt: 1 });
        tx.objectStore("thumbnails").put({ assetId: id, blob });
      }
      tx.objectStore("items").put({ id: "gallery-test", type: "image", title: "Design studies", assetIds: assets.map(asset => asset.id), caption: "Notes stay below the gallery.", sourceUrl: "", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.goto("/items/gallery-test");
  await expect(page.getByRole("button", { name: "Scroll view" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Gallery view" }).getByRole("button")).toHaveText(["Slides", "Scroll"]);
}

async function readImage(page: Page, index: number, offset = 100) {
  const row = page.locator(`[data-gallery-index="${index}"]`);
  await row.evaluate((element, offset) => {
    const scroller = element.closest<HTMLElement>('[data-testid="item-page-scroll"]')!;
    scroller.scrollTop += element.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12 + offset;
  }, offset);
  await expect(row.locator("img")).toBeVisible();
  await expect.poll(() => row.locator("img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await row.evaluate((element, offset) => new Promise<void>(resolve => requestAnimationFrame(() => {
    const scroller = element.closest<HTMLElement>('[data-testid="item-page-scroll"]')!;
    scroller.scrollTop += element.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12 + offset;
    resolve();
  })), offset);
}

test("image header theme control stays on the far right and persists the selected theme", async ({ page }, testInfo) => {
  await seedGallery(page);
  const header = page.getByRole("banner");
  const theme = header.getByRole("button", { name: "Theme", exact: true });
  for (const width of [1707, 320]) {
    await page.setViewportSize({ width, height: 825 });
    await expect(theme).toBeInViewport();
    const themeBounds = await theme.boundingBox();
    const headerBounds = await header.locator("div").first().boundingBox();
    expect(themeBounds!.x + themeBounds!.width).toBeGreaterThan(headerBounds!.x + headerBounds!.width - 30);
    await expect(header.getByRole("button", { name: "Move item to Trash" })).toHaveCount(0);
    expect(await page.locator("body").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    const previous = await page.locator("html").getAttribute("data-theme");
    await theme.click();
    const selected = previous === "dark" ? "light" : "dark";
    await expect(page.locator("html")).toHaveAttribute("data-theme", selected);
    await page.reload();
    await expect(theme).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", selected);
    await page.screenshot({ path: testInfo.outputPath(`image-header-theme-${width}.png`) });
  }
});

test("image details hold gallery controls and the viewer aligns its menu and image count", async ({ page }, testInfo) => {
  await seedGallery(page);
  const controls = ["Slides view", "Scroll view", "Add images", "Edit details"];
  for (const width of [1707, 1440, 768, 390, 320, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("button", { name: "Slides view", exact: true }).click();
    await page.getByTestId("item-page-scroll").evaluate(node => { node.scrollTop = 0; });
    const before = await Promise.all(controls.map(name => page.getByRole("button", { name, exact: true }).boundingBox()));
    expect(before.every(Boolean)).toBe(true);
    const details = page.getByRole("complementary", { name: "Image details" });
    for (const name of controls) await expect(details.getByRole("button", { name, exact: true })).toBeVisible();
    const viewerBounds = (await page.getByRole("region", { name: "Image gallery" }).boundingBox())!;
    const countBounds = (await page.getByLabel("Current image", { exact: true }).boundingBox())!;
    const thumbnails = (await page.getByRole("navigation", { name: "Image slides" }).boundingBox())!;
    expect(countBounds.x + countBounds.width).toBeCloseTo(viewerBounds.x + viewerBounds.width, 0);
    expect(countBounds.y).toBeGreaterThan(viewerBounds.y);
    expect(countBounds.y + countBounds.height).toBeLessThan(thumbnails.y + thumbnails.height);
    expect(countBounds.y).toBeGreaterThanOrEqual(thumbnails.y);
    const thumbnailBounds = (await page.getByRole("button", { name: "Show image 1", exact: true }).boundingBox())!;
    expect(countBounds.height).toBeCloseTo(thumbnailBounds.height, 0);
    const imageMenu = page.getByRole("button", { name: "Current image actions" });
    const menuBounds = (await imageMenu.boundingBox())!;
    const nextBounds = (await page.getByRole("button", { name: "Next image", exact: true }).boundingBox())!;
    expect(menuBounds.x + menuBounds.width).toBeCloseTo(nextBounds.x + nextBounds.width, 0);
    expect(menuBounds.y).toBeCloseTo(viewerBounds.y + 24, 0);
    expect(menuBounds.y - viewerBounds.y).toBeCloseTo(viewerBounds.x + viewerBounds.width - menuBounds.x - menuBounds.width, 0);
    const fullScreenButton = page.getByRole("button", { name: "View image full screen", exact: true });
    await fullScreenButton.hover();
    const fullScreenIcon = (await fullScreenButton.locator(":scope > span").boundingBox())!;
    const mediaBounds = (await fullScreenButton.boundingBox())!;
    expect(fullScreenIcon.y + fullScreenIcon.height).toBeCloseTo(mediaBounds.y + mediaBounds.height - 12, 0);
    await page.screenshot({ path: testInfo.outputPath(`gallery-slides-${width}.png`) });
    if (width === 1707) {
      await imageMenu.click();
      const menu = page.getByRole("menu", { name: "Current image actions" });
      await expect(menu.getByRole("menuitem", { name: "Extract palette" })).toBeVisible();
      await expect(menu.getByRole("menuitem", { name: "Read text", exact: true })).toBeVisible();
      await expect(menu.getByRole("menuitem", { name: "Replace current image" })).toBeVisible();
      await expect(menu.getByRole("menuitem", { name: "Remove current image" })).toBeVisible();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByLabel("Current image", { exact: true })).toHaveAttribute("title", "Image 1 of 10");
      await page.screenshot({ path: testInfo.outputPath("gallery-image-actions.png") });
      await page.keyboard.press("Escape");
      await expect(imageMenu).toBeFocused();
    }
    await expect(details.getByRole("button", { name: "Organize", exact: true })).toBeVisible();
    await expect(details.getByRole("button", { name: "Move item to Trash" })).toBeVisible();
    const organize = (await details.getByRole("button", { name: "Organize", exact: true }).boundingBox())!;
    const trash = (await details.getByRole("button", { name: "Move item to Trash" }).boundingBox())!;
    const viewToggle = (await details.getByRole("group", { name: "Gallery view", exact: true }).boundingBox())!;
    const saved = (await details.getByText("Saved", { exact: true }).boundingBox())!;
    expect(saved.y + saved.height).toBeLessThan(viewToggle.y);
    const edit = (await details.getByRole("button", { name: "Edit details" }).boundingBox())!;
    expect(organize.y + organize.height).toBeLessThan(viewToggle.y);
    expect(edit.y).toBeGreaterThanOrEqual(viewToggle.y + viewToggle.height);
    expect(organize.x).toBeCloseTo(trash.x, 0);
    expect(organize.width).toBeCloseTo(trash.width, 0);
    expect(trash.y).toBeGreaterThan(organize.y + organize.height);
    await page.getByRole("button", { name: "Scroll view", exact: true }).click();
    await expect(page.getByRole("list", { name: "Images in scroll view" })).toBeVisible();
    const after = await Promise.all(controls.map(name => page.getByRole("button", { name, exact: true }).boundingBox()));
    for (let index = 0; index < controls.length; index++) {
      if (width < 1024) continue;
      for (const dimension of ["x", "y", "width", "height"] as const) {
        expect(after[index]![dimension], `${controls[index]} ${dimension} at ${width}px`).toBeCloseTo(before[index]![dimension], 0);
      }
      await expect(page.getByRole("button", { name: controls[index], exact: true })).toBeInViewport();
    }
    expect(await page.locator("body").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`gallery-details-${width}.png`) });
  }
});

test("scroll gallery loads nearby images, preserves reading position, and works offline", async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await seedGallery(page);
  await page.getByRole("button", { name: "Scroll view" }).click();
  const list = page.getByRole("list", { name: "Images in scroll view" });
  await expect(list.getByRole("listitem")).toHaveCount(10);
  await expect(list.locator("img").first()).toBeVisible();
  expect(await list.locator("img").count()).toBeLessThan(10);
  await expect(page.locator('[data-gallery-index="9"] img')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("gallery-scroll-desktop.png") });

  await readImage(page, 2, 180);
  await expect(page.getByLabel("Current image", { exact: true })).toHaveAttribute("title", "Image 3 of 10");
  const scroller = page.getByTestId("item-page-scroll");
  const before = await scroller.evaluate(element => element.scrollTop);
  const readingOffset = () => page.locator('[data-gallery-index="2"]').evaluate(element => element.getBoundingClientRect().top - element.closest('[data-testid="item-page-scroll"]')!.getBoundingClientRect().top);
  const beforeOffset = await readingOffset();
  await page.getByRole("button", { name: "View image 3 full screen", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Focused image viewer" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Focused image viewer" })).toBeHidden();
  await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeCloseTo(before, 0);
  await page.getByRole("button", { name: "Slides view" }).click();
  await expect(page.getByRole("button", { name: "Show image 3", exact: true })).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "Scroll view" }).click();
  await expect.poll(readingOffset).toBeCloseTo(beforeOffset, 0);
  await context.setOffline(true);
  await readImage(page, 7);
  await expect(page.getByLabel("Current image", { exact: true })).toHaveAttribute("title", "Image 8 of 10");
  expect(errors).toEqual([]);
});

test("adding and replacing images in scroll view keeps natural sizes and the affected image in view", async ({ page }, testInfo) => {
  await seedGallery(page);
  await page.getByRole("button", { name: "Scroll view" }).click();
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = 180;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "oklch(0.639808265 0.049293261 141.104434878)";
    context.fillRect(0, 0, 120, 180);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!)));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  const file = { name: "added.png", mimeType: "image/png", buffer: Buffer.from(bytes) };
  await page.getByLabel("Choose images to add").setInputFiles(file);
  await expect(page.getByRole("list", { name: "Images in scroll view" }).getByRole("listitem")).toHaveCount(11);
  await expect(page.getByLabel("Current image", { exact: true })).toHaveAttribute("title", "Image 11 of 11");
  await expect(page.locator('[data-gallery-index="10"] img')).toBeInViewport();
  await expect.poll(() => page.locator('[data-gallery-index="10"] img').evaluate(image => ({ width: image.clientWidth, height: image.clientHeight }))).toEqual({ width: 120, height: 180 });
  await page.getByLabel("Choose replacement image").setInputFiles({ ...file, buffer: await sharp(file.buffer).resize(180, 120).png().toBuffer() });
  await expect(page.getByLabel("Current image", { exact: true })).toHaveAttribute("title", "Image 11 of 11");
  await expect(page.locator('[data-gallery-index="10"] img')).toBeInViewport();
  await expect.poll(() => page.locator('[data-gallery-index="10"] img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(180);
  await expect.poll(() => page.locator('[data-gallery-index="10"] img').evaluate(image => ({ width: image.clientWidth, height: image.clientHeight }))).toEqual({ width: 180, height: 120 });
  await page.screenshot({ path: testInfo.outputPath("gallery-natural-size.png") });
});

test("scroll gallery opens the chosen original, navigates full screen, and returns to that image", async ({ page }) => {
  await seedGallery(page);
  await page.getByRole("button", { name: "Show image 4", exact: true }).click();
  await page.getByRole("button", { name: "Scroll view" }).click();
  await expect(page.getByLabel("Current image", { exact: true })).toHaveAttribute("title", "Image 4 of 10");
  await page.getByRole("button", { name: "View image 4 full screen", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "Focused image viewer" });
  await expect(viewer.getByLabel("Image 4 of 10", { exact: true })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(viewer.getByLabel("Image 5 of 10", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
  await expect(page.getByRole("button", { name: "Scroll view" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-gallery-index="4"] img')).toBeInViewport();
  await page.getByRole("button", { name: "Slides view" }).click();
  await expect(page.getByRole("button", { name: "Show image 5", exact: true })).toHaveAttribute("aria-current", "true");
});

test("zoomed originals remain fully reachable in the viewer", async ({ page }, testInfo) => {
  await seedGallery(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole("button", { name: "Scroll view" }).click();
    await page.getByRole("button", { name: "View image 1 full screen", exact: true }).click();
    const viewer = page.getByRole("dialog", { name: "Focused image viewer" });
    const image = viewer.locator("img");
    await expect(image).toBeVisible();
    const before = (await image.boundingBox())!;
    await viewer.getByRole("button", { name: "Zoom in image" }).click({ position: { x: before.width / 2, y: 200 } });
    const zoomOut = viewer.getByRole("button", { name: "Zoom out image" });
    await expect(zoomOut).toBeVisible();
    await expect.poll(async () => (await zoomOut.boundingBox())!.width).toBeCloseTo(before.width * 2, 0);
    const scroller = page.getByTestId("focused-image-scroll");
    const horizontalOverflow = await scroller.evaluate(element => element.scrollWidth > element.clientWidth);
    const position = await scroller.evaluate(element => ({ left: element.scrollLeft, top: element.scrollTop }));
    await page.mouse.move(width / 2, 400);
    await page.mouse.down();
    await page.mouse.move(width / 2 - 80, 300, { steps: 5 });
    await page.mouse.up();
    await expect(zoomOut).toBeVisible();
    await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(position.top + 90);
    if (horizontalOverflow) await expect.poll(() => scroller.evaluate(element => element.scrollLeft)).toBeGreaterThan(position.left);
    else await expect(scroller).toHaveJSProperty("scrollLeft", 0);
    await scroller.evaluate(element => {
      element.scrollLeft = element.scrollWidth;
      element.scrollTop = element.scrollHeight;
    });
    const end = (await image.boundingBox())!;
    expect(end.x + end.width).toBeLessThanOrEqual(width);
    if (horizontalOverflow) expect(end.x + end.width).toBeGreaterThan(width - 50);
    else expect(end.x).toBeGreaterThanOrEqual(0);
    expect(end.y + end.height).toBeLessThanOrEqual(844);
    expect(end.y + end.height).toBeGreaterThan(794);
    await expect(viewer.getByLabel("Image 1 of 10", { exact: true })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: testInfo.outputPath(`zoom-bottom-right-${width}.png`) });
    await scroller.evaluate(element => {
      element.scrollLeft = 0;
      element.scrollTop = 0;
    });
    const start = (await image.boundingBox())!;
    expect(start.x).toBeGreaterThanOrEqual(0);
    if (horizontalOverflow) expect(start.x).toBeLessThan(25);
    else expect(start.x + start.width).toBeLessThanOrEqual(width);
    expect(start.y).toBeGreaterThanOrEqual(0);
    expect(start.y).toBeLessThan(25);
    await viewer.getByRole("button", { name: "Zoom out", exact: true }).click();
    await expect.poll(async () => (await image.boundingBox())!.width).toBeCloseTo(before.width, 0);
    await page.keyboard.press("Escape");
    await expect(viewer).toBeHidden();
  }
});

test("scroll view stays usable at narrow widths and removes only the current image", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await seedGallery(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Scroll view" }).focus();
  await page.keyboard.press("Enter");
  await readImage(page, 1, 30);
  await expect(page.getByLabel("Current image", { exact: true })).toHaveAttribute("title", "Image 2 of 10");
  await page.getByRole("button", { name: "Image 2 actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Remove current image" }).click();
  const confirmation = page.getByRole("dialog", { name: "Remove this image?" });
  await expect(confirmation).toContainText("Remove image 2");
  await confirmation.getByRole("button", { name: "Remove image", exact: true }).click();
  await expect(confirmation).toBeHidden();
  await expect(page.getByRole("list", { name: "Images in scroll view" }).getByRole("listitem")).toHaveCount(9);
  await expect(page.locator('[data-gallery-asset="gallery-asset-1"]')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("gallery-scroll-mobile.png") });
  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await readImage(page, 0, 0);
    const imageWidth = await page.locator('[data-gallery-index="0"] img').evaluate(image => image.clientWidth);
    const columnWidth = await page.getByRole("list", { name: "Images in scroll view" }).evaluate(element => element.clientWidth);
    expect(imageWidth).toBeCloseTo(Math.min(800, columnWidth), 0);
    expect(await page.locator("body").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(page.getByRole("button", { name: "Slides view" })).toBeVisible();
  }
});
