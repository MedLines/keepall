import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";

test.use({ serviceWorkers: "block" });

const videoFile = join(__dirname, "fixtures", "tiny.mp4");

test("captures, plays, and backs up a local video", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  const capture = page.getByRole("dialog", { name: "Save to Keepall" });
  await capture.locator('input[accept="video/mp4,video/webm"]').setInputFiles(videoFile);
  await expect(capture.getByText("Video: tiny.mp4")).toBeVisible();
  await expect(capture.getByRole("button", { name: "Add image" })).toHaveCount(0);
  await expect(capture.getByRole("button", { name: "Paste image" })).toHaveCount(0);
  await expect(capture.getByRole("button", { name: "Add video" })).toHaveCount(0);
  await capture.getByRole("textbox", { name: "Video title" }).fill("Local test video");
  await capture.getByRole("textbox", { name: "Notes (optional)" }).fill("# Watch later");
  await capture.getByRole("button", { name: "Markdown" }).click();
  await capture.getByRole("button", { name: "Preview" }).click();
  await expect(capture.getByRole("region", { name: "Video note preview" })).toContainText("Watch later");
  await capture.getByRole("button", { name: "Save", exact: true }).click();
  await expect(capture).toBeHidden();
  await expect(page.getByText("Local test video", { exact: true })).toBeVisible();
  await expect(page.getByTestId("video-play-overlay")).toBeVisible();
  const card = page.locator(".library-card").filter({ hasText: "Local test video" });
  await card.hover();
  await card.locator("button.library-card-actions").click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  const cardEditor = page.getByRole("dialog", { name: "Edit video details" });
  await expect(cardEditor).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
  await cardEditor.getByRole("button", { name: "Cancel" }).click();
  await expect(cardEditor).toBeHidden();
  await page.getByText("Local test video", { exact: true }).click();
  await expect(page).toHaveURL(/\/items\//);
  const player = page.locator("video[controls]");
  await expect(player).toBeVisible();
  await expect.poll(() => player.evaluate((element: HTMLVideoElement) => element.duration)).toBeGreaterThan(0);
  await expect(player).toHaveAttribute("poster", /^blob:/);
  const notes = page.getByRole("article", { name: "Notes" });
  await expect(notes.getByRole("heading", { name: "Watch later" })).toBeVisible();
  const scroll = page.getByTestId("item-page-scroll");
  await expect.poll(() => scroll.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await scroll.evaluate((element) => element.scrollTo(0, element.scrollHeight));
  await expect(notes).toBeInViewport();
  await page.getByRole("button", { name: "Edit details" }).click();
  const details = page.getByRole("dialog", { name: "Edit video details" });
  await expect(details).toBeVisible();
  await expect(details.getByRole("textbox", { name: "Source URL (optional)" })).toHaveCount(0);
  await details.getByRole("textbox", { name: "Notes", exact: true }).fill("## Watch this soon");
  await details.getByRole("button", { name: "Save changes" }).click();
  await expect(notes.getByRole("heading", { name: "Watch this soon" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("article", { name: "Notes" }).getByRole("heading", { name: "Watch this soon" })).toBeVisible();

  await page.getByRole("link", { name: "Library" }).click();
  await page.getByRole("link", { name: "Settings" }).click();
  const backup = page.getByRole("region", { name: "Backup" });
  const downloadPromise = page.waitForEvent("download");
  await backup.getByRole("button", { name: "Export backup", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.keepall\.zip$/);
  const archivePath = await download.path();
  await backup.locator('input[accept*="application/zip"]').setInputFiles(archivePath!);
  await page.getByRole("dialog", { name: "Import backup" }).getByRole("button", { name: "Replace" }).click();
  await expect(backup).toContainText("Library replaced from backup.");
  await page.getByRole("link", { name: "Back to library" }).click();
  await expect(page.getByText("Local test video", { exact: true })).toBeVisible();
  await page.getByText("Local test video", { exact: true }).click();
  await expect(page.locator("video[controls]")).toBeVisible();
  await expect(page.locator("video[controls]")).toHaveAttribute("poster", /^blob:/);
  await expect(page.getByRole("article", { name: "Notes" }).getByRole("heading", { name: "Watch this soon" })).toBeVisible();
});

test("a large image uses a small card thumbnail and opens its original", async ({ page }) => {
  test.setTimeout(120_000);
  const raw = randomBytes(2600 * 2600 * 3);
  const image = await sharp(raw, { raw: { width: 2600, height: 2600, channels: 3 } })
    .png({ compressionLevel: 0 }).toBuffer();
  expect(image.byteLength).toBeGreaterThan(18 * 1024 * 1024);
  expect(image.byteLength).toBeLessThanOrEqual(20 * 1024 * 1024);

  await page.goto("/");
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  const capture = page.getByRole("dialog", { name: "Save to Keepall" });
  await capture.locator('input[accept^="image/"]').setInputFiles({
    name: "large.png", mimeType: "image/png", buffer: image,
  });
  await capture.getByRole("textbox", { name: "Optional source URL or caption" }).fill("Large image test");
  await capture.getByRole("button", { name: "Save", exact: true }).click();
  await expect(capture).toBeHidden();
  const card = page.locator(".library-card").filter({ hasText: "Large image test" });
  const cardImage = card.locator("img");
  await expect(cardImage).toBeVisible();
  const thumbnailBytes = await cardImage.evaluate(async (element: HTMLImageElement) => (await fetch(element.src)).blob().then((blob) => blob.size));
  expect(thumbnailBytes).toBeLessThan(512 * 1024);
  await card.getByRole("link", { name: "Open Large image test" }).click();
  await expect(page.getByRole("region", { name: "Image gallery" })).toBeVisible();
  const originalImage = page.locator(".item-workspace-media img").first();
  await expect(originalImage).toBeVisible();
  const originalBytes = await originalImage.evaluate(async (element: HTMLImageElement) => (await fetch(element.src)).blob().then((blob) => blob.size));
  expect(originalBytes).toBe(image.byteLength);
});

test("video details keep actions reachable and link metadata across widths", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  const capture = page.getByRole("dialog", { name: "Save to Keepall" });
  await capture.locator('input[accept="video/mp4,video/webm"]').setInputFiles(videoFile);
  await capture.getByRole("textbox", { name: "Video title" }).fill("A very long local video title about a collection of favorite scenes and edits");
  await capture.getByRole("textbox", { name: "Notes (optional)" }).fill("A long note about this video.\n".repeat(100));
  await capture.getByRole("button", { name: "Save", exact: true }).click();
  await expect(capture).toBeHidden();
  await page.getByText("A very long local video title about a collection of favorite scenes and edits", { exact: true }).click();
  await expect(page.locator("video[controls]")).toBeVisible();
  await expect.poll(() => page.locator("video[controls]").evaluate((video: HTMLVideoElement) => video.duration)).toBeGreaterThan(0);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const id = decodeURIComponent(location.pathname.split("/").at(-1)!);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["items", "collections", "tags"], "readwrite");
      const get = tx.objectStore("items").get(id);
      get.onsuccess = () => tx.objectStore("items").put({ ...get.result, collectionIds: ["videos & edits"], tagIds: ["watch/later"] });
      tx.objectStore("collections").put({ id: "videos & edits", name: "Videos & edits", createdAt: 1, pinnedItemIds: [] });
      tx.objectStore("tags").put({ id: "watch/later", name: "watch/later", createdAt: 1 });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  const details = page.getByRole("complementary", { name: "Video details" });
  await expect(details.getByRole("link", { name: "Videos & edits" })).toHaveAttribute("href", "/?collection=videos%20%26%20edits");
  await expect(details.getByRole("link", { name: "watch/later" })).toHaveAttribute("href", "/?tag=watch%2Flater");
  await expect(details).toContainText("Saved");
  await expect(details).toContainText("tiny.mp4");

  for (const width of [320, 768, 1280]) {
    await page.setViewportSize({ width, height: 700 });
    const scroll = page.getByTestId("item-page-scroll");
    await scroll.evaluate((element) => element.scrollTo(0, element.scrollHeight));
    await expect(page.getByRole("link", { name: "Library" })).toBeInViewport();
    for (const action of ["Edit details", "Organize", "Move to Trash"]) {
      await expect(page.getByRole("button", { name: action, exact: true })).toBeInViewport();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await details.getByRole("link", { name: "Videos & edits" }).click();
  await expect(page).toHaveURL(/collection=videos%20%26%20edits/);
  await expect(page.getByText("A very long local video title about a collection of favorite scenes and edits", { exact: true })).toBeVisible();
  await page.goBack();
  await details.getByRole("link", { name: "watch/later" }).click();
  await expect(page).toHaveURL(/tag=watch%2Flater/);
});

test("missing local video ends loading and offers a retry", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  const capture = page.getByRole("dialog", { name: "Save to Keepall" });
  await capture.locator('input[accept="video/mp4,video/webm"]').setInputFiles(videoFile);
  await capture.getByRole("textbox", { name: "Video title" }).fill("Missing video example");
  await capture.getByRole("button", { name: "Save", exact: true }).click();
  await expect(capture).toBeHidden();
  await page.getByText("Missing video example", { exact: true }).click();
  await expect(page.locator("video[controls]")).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const id = decodeURIComponent(location.pathname.split("/").at(-1)!);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["items", "videoAssets"], "readwrite");
      const get = tx.objectStore("items").get(id);
      get.onsuccess = () => tx.objectStore("videoAssets").delete(get.result.assetId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByRole("alert").filter({ hasText: "saved video file is missing" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry video" })).toBeVisible();
  await expect(page.getByText("Loading video…")).toHaveCount(0);
});
