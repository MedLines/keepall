import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.use({ serviceWorkers: "block" });

async function seedLibrary(page: Page, fixture?: number[]) {
  await page.addInitScript(() => {
    const state = { reads: 0, videoUrls: [] as string[], revoked: [] as string[] };
    Object.assign(window, { previewProbe: state });
    const get = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (key) { if (this.name === "videoAssets") state.reads++; return get.call(this, key); };
    const create = URL.createObjectURL;
    URL.createObjectURL = blob => { const url = create(blob); if (blob instanceof Blob && blob.type.startsWith("video/")) state.videoUrls.push(url); return url; };
    const revoke = URL.revokeObjectURL;
    URL.revokeObjectURL = url => { state.revoked.push(url); revoke(url); };
  });
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.evaluate(async fixture => {
    const video = fixture ? new Blob([new Uint8Array(fixture)], { type: "video/webm" }) : await (await fetch("/marketing/capture-image-demo.webm")).blob();
    const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 512;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#345d4c"; context.fillRect(0, 0, 640, 512);
    const thumbnail = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), "image/webp"));
    const db = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result); });
    const tx = db.transaction(["items", "videoAssets", "thumbnails", "previewLayouts"], "readwrite");
    for (let index = 0; index < 90; index++) {
      const id = `hover-${index}`;
      const common = { id, title: index < 3 ? `Video ${index}` : `Note ${index}`, tagIds: [], collectionIds: [], createdAt: 90 - index, updatedAt: 90 - index };
      tx.objectStore("items").put(index < 3 ? { ...common, type: "video", assetId: id, sourceFileName: "reference.webm", noteContent: "" } : { ...common, type: "note", content: "A saved note to check scrolling past video cards." });
      if (index < 3) {
        tx.objectStore("thumbnails").put({ assetId: id, blob: thumbnail });
        tx.objectStore("previewLayouts").put({ assetId: id, width: 640, height: 512 });
        if (index < 2) tx.objectStore("videoAssets").put({ id, blob: video, mimeType: "video/webm", byteLength: video.size, createdAt: 1 });
      }
    }
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  }, fixture);
  await page.reload();
  await expect(page.locator('[data-item-id="hover-0"] img')).toBeVisible();
}

async function probe(page: Page) {
  return page.evaluate(() => (window as unknown as { previewProbe: { reads: number; videoUrls: string[]; revoked: string[] } }).previewProbe);
}

test("card previews stay idle while browsing, sample silently, refresh the poster, and release on scroll", async ({ page, browserName }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedLibrary(page);
  const first = page.locator('[data-item-id="hover-0"]');
  const second = page.locator('[data-item-id="hover-1"]');
  await expect(first.getByRole("img", { name: "Video", exact: true })).toHaveCount(1);
  await expect(first.getByTestId("video-play-overlay")).toHaveCount(0);
  await page.mouse.move(0, 0);
  expect((await probe(page)).reads).toBe(0);
  await expect(page.locator("video")).toHaveCount(0);
  await first.hover();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(550);
  expect((await probe(page)).reads).toBe(0);
  const poster = first.locator("img");
  const initialPoster = await poster.getAttribute("src");
  const initialSize = await first.boundingBox();
  await first.screenshot({ path: testInfo.outputPath(`${browserName}-video-card.png`) });
  await first.hover();
  const preview = first.locator('video[data-video-preview="playing"]');
  await expect(preview).toBeVisible();
  expect(await preview.evaluate((video: HTMLVideoElement) => ({ muted: video.muted, controls: video.controls, paused: video.paused }))).toEqual({ muted: true, controls: false, paused: false });
  await expect.poll(() => preview.evaluate((video: HTMLVideoElement) => video.currentTime / video.duration)).toBeGreaterThan(0.1);
  await expect.poll(() => preview.evaluate((video: HTMLVideoElement) => video.currentTime / video.duration)).toBeGreaterThan(0.4);
  await expect.poll(() => poster.getAttribute("src")).not.toBe(initialPoster);
  expect(await poster.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(640);
  const playingSize = await first.boundingBox();
  expect(Math.abs(playingSize!.height - initialSize!.height)).toBeLessThan(1);
  await first.screenshot({ path: testInfo.outputPath(`${browserName}-video-card-preview.png`) });
  await second.hover();
  await expect(first.locator("video")).toHaveCount(0);
  await expect(second.locator('video[data-video-preview="playing"]')).toBeVisible();
  await expect(page.locator("video")).toHaveCount(1);
  let state = await probe(page);
  expect(state.reads).toBe(2);
  expect(state.revoked).toContain(state.videoUrls[0]);
  await page.mouse.wheel(0, 700);
  await expect(page.locator("video")).toHaveCount(0);
  state = await probe(page);
  expect(state.revoked).toContain(state.videoUrls[1]);
  await page.mouse.move(0, 0);
  await first.scrollIntoViewIfNeeded();
  await first.hover();
  await expect(first.locator('video[data-video-preview="playing"]')).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(page.locator("video")).toHaveCount(0);
  const missing = page.locator('[data-item-id="hover-2"]');
  await missing.hover();
  await expect.poll(async () => (await probe(page)).reads).toBe(4);
  await expect(missing.locator("video")).toHaveCount(0);
  await expect(missing.locator("img")).toBeVisible();
  await page.mouse.move(0, 0);
  await first.getByRole("link", { name: "Open Video 0", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Video 0", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("reduced motion keeps cards static without loading the videos", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedLibrary(page);
  await page.locator('[data-item-id="hover-0"]').hover();
  await page.waitForTimeout(600);
  await expect(page.locator("video")).toHaveCount(0);
  expect((await probe(page)).reads).toBe(0);
});

test("the saved thumbnail matches the preview's starting frame and blends only after a frame is ready", async ({ page }) => {
  await seedLibrary(page, Array.from(await readFile("e2e/fixtures/video-color-ramp.webm")));
  const card = page.locator('[data-item-id="hover-0"]');
  const poster = card.locator("img");
  const original = await poster.getAttribute("src");
  await card.hover();
  const preview = card.locator('video[data-video-preview="playing"]');
  await expect(preview).toBeVisible();
  await expect(preview).toHaveCSS("transition-property", "opacity");
  await expect(preview).toHaveCSS("transition-duration", "0.18s");
  await expect(poster).toBeVisible();
  await expect.poll(() => poster.getAttribute("src")).not.toBe(original);
  await page.mouse.move(8, 8);
  await expect(card.locator("video")).toHaveCount(0);
  const error = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result); });
    const tx = db.transaction(["videoAssets", "thumbnails"]);
    const read = (name: string) => new Promise<{ blob: Blob }>(resolve => { const request = tx.objectStore(name).get("hover-0"); request.onsuccess = () => resolve(request.result); });
    const [asset, thumbnail] = await Promise.all([read("videoAssets"), read("thumbnails")]);
    db.close();
    const video = document.createElement("video");
    const url = URL.createObjectURL(asset.blob);
    try {
      await new Promise<void>((resolve, reject) => { video.onloadeddata = () => resolve(); video.onerror = () => reject(video.error); video.src = url; });
      await new Promise<void>(resolve => { video.onseeked = () => resolve(); video.currentTime = Math.min(5, video.duration * 0.12); });
      const bitmap = await createImageBitmap(thumbnail.blob);
      const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const startingFrame = context.getImageData(0, 0, canvas.width, canvas.height).data;
      context.drawImage(bitmap, 0, 0);
      const savedPoster = context.getImageData(0, 0, canvas.width, canvas.height).data;
      bitmap.close();
      let difference = 0;
      for (let index = 0; index < startingFrame.length; index++) if (index % 4 !== 3) difference += Math.abs(startingFrame[index] - savedPoster[index]);
      return difference / (canvas.width * canvas.height * 3);
    } finally { video.removeAttribute("src"); video.load(); URL.revokeObjectURL(url); }
  });
  expect(error).toBeLessThan(4); // Allow WebP compression, but reject a later frame from the moving color ramp.
  await page.reload();
  await expect(page.locator('[data-item-id="hover-0"] img')).toBeVisible();
  expect((await probe(page)).reads).toBe(0);
});
