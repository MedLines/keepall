import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("cards and inset previews use radii appropriate to corner-shape support", async ({ page, browserName }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const canvas = document.createElement("canvas");
    canvas.width = 600; canvas.height = 400;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#c4a477"; context.fillRect(0, 0, 600, 400);
    context.fillStyle = "#f8f5ef"; context.fillRect(12, 12, 576, 376);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), "image/png"));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const tx = db.transaction(["items", "assets"], "readwrite");
    tx.objectStore("assets").put({ id: "corner-image", bytes, mimeType: blob.type, byteLength: blob.size, contentHash: "corner-image", createdAt: 1 });
    tx.objectStore("assets").put({ id: "corner-image-alt", bytes, mimeType: blob.type, byteLength: blob.size, contentHash: "corner-image-alt", createdAt: 1 });
    const common = { tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 };
    tx.objectStore("items").put({ ...common, id: "corner-note", type: "note", title: "Reading reference", content: "Saved text should have a modest corner curve and a matching inset preview." });
    tx.objectStore("items").put({ ...common, id: "corner-image", type: "image", title: "Image reference", assetIds: ["corner-image", "corner-image-alt"], sourceUrl: "", caption: "" });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.locator(".library-card")).toHaveCount(2);
  await expect(page.locator('[data-item-id="corner-image"] img')).toBeVisible();
  const supportsSquircle = await page.evaluate(() => CSS.supports("corner-shape", "squircle"));
  const radius = supportsSquircle ? 64 : 24;
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const closeNavigation = page.getByRole("button", { name: "Close navigation", exact: true });
    if (await closeNavigation.isVisible()) await closeNavigation.click();
    for (const theme of ["light", "dark"]) {
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      for (const card of await page.locator(".library-card").all()) {
        await expect(card).toHaveCSS("border-radius", `${radius}px`);
        if (supportsSquircle) await expect(card).toHaveCSS("corner-shape", /^(squircle|superellipse\(2\))$/);
      }
      for (const media of await page.locator(".library-card-media").all()) {
        await expect(media).toHaveCSS("border-radius", `${radius}px`);
        await expect(media).toHaveCSS("border-width", "8px");
        if (supportsSquircle) await expect(media).toHaveCSS("corner-shape", /^(squircle|superellipse\(2\))$/);
        expect(await media.evaluate(node => getComputedStyle(node, "::after").borderRadius)).toBe(`${radius}px`);
      }
      await expect(page.locator(".media-squircle-inset").first()).toHaveCSS("border-radius", `${radius - 8}px`);
      await page.screenshot({ path: testInfo.outputPath(`${browserName}-corners-${width}-${theme}.png`) });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/items/corner-image");
  const imageFrame = page.locator(".image-viewer-canvas");
  await expect(imageFrame).toBeVisible();
  await expect(imageFrame).toHaveCSS("border-radius", `${radius}px`);
  expect(await imageFrame.evaluate(node => getComputedStyle(node, "::after").borderRadius)).toBe(`${radius}px`);
  const detailsPanel = page.getByRole("complementary", { name: "Image details" });
  await expect(detailsPanel).toBeVisible();
  await expect(detailsPanel).toHaveCSS("border-radius", supportsSquircle ? "32px" : `${radius}px`);
  await expect(page.getByRole("button", { name: "Show image 2", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`${browserName}-image-item-corners.png`) });
  await page.getByRole("button", { name: "View image full screen", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "Focused image viewer" });
  await expect(viewer).toBeVisible();
  await expect(viewer.locator("img")).toHaveCSS("border-radius", "0px");
  await viewer.screenshot({ path: testInfo.outputPath(`${browserName}-fullscreen-image.png`) });
  await page.getByRole("button", { name: "Close full-screen image", exact: true }).click();
  expect(errors).toEqual([]);
});
