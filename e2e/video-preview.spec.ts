import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("quick preview uses shared playback controls without browsing away from the video", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
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
    const tx = db.transaction(["items", "videoAssets"], "readwrite");
    tx.objectStore("videoAssets").put({ id: "preview-video", blob, mimeType: blob.type, byteLength: blob.size, createdAt: 2 });
    const common = { tagIds: [], collectionIds: [], updatedAt: 2 };
    tx.objectStore("items").put({ ...common, id: "preview-video", type: "video", title: "Preview recording", assetId: "preview-video", sourceFileName: "recording.webm", noteContent: "Saved video notes", createdAt: 2 });
    tx.objectStore("items").put({ ...common, id: "preview-note", type: "note", title: "Next note", content: "Saved text", format: "plain", createdAt: 1 });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  });
  await page.reload();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Preview recording" });
  const player = dialog.getByRole("region", { name: "Video player" });
  const video = player.locator("video");
  await expect(player).toBeVisible();
  await expect(video).not.toHaveAttribute("controls");
  await expect(video).not.toHaveAttribute("autoplay");
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => Number.isFinite(node.duration) && node.duration > 0)).toBe(true);
  await expect(dialog.getByRole("status", { name: "Loading video" })).toHaveCount(0);
  await expect(dialog.getByRole("region", { name: "Video notes" })).toHaveText("Saved video notes");

  await player.focus();
  await player.press("Space");
  await expect(player.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(0);
  await player.press("Space");
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
  await player.press("ArrowRight");
  await expect(dialog).toBeVisible();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(1);

  await player.getByRole("button", { name: "Playback speed" }).click();
  await expect(page.getByRole("menu", { name: "Playback speed" })).toBeVisible();
  await expect(page.getByRole("menu", { name: "Playback speed" })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByRole("menuitemradio", { name: "0.5x", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: "0.75x", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.playbackRate)).toBe(0.75);
  await expect(dialog).toBeVisible();
  await player.getByRole("button", { name: "Mute", exact: true }).click();
  await expect(player.getByRole("button", { name: "Unmute", exact: true })).toBeVisible();
  await player.getByRole("button", { name: "Full screen", exact: true }).click();
  await expect.poll(() => player.evaluate(node => document.fullscreenElement === node)).toBe(true);
  await player.getByRole("button", { name: "Exit full screen", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 825 });
    await expect(player.getByRole("button", { name: "Full screen", exact: true })).toBeInViewport();
    await expect(player.getByRole("button", { name: "Playback speed" })).toBeInViewport();
    expect(await player.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth && node.scrollHeight <= node.clientHeight)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`video-preview-${width}.png`) });
  }
  await dialog.getByRole("button", { name: "Next item" }).click();
  await expect(page.getByRole("dialog", { name: "Next note" })).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  await page.getByRole("button", { name: "Previous item" }).click();
  await expect(player.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBe(0);
  expect(errors).toEqual([]);
});
