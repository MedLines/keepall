import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/.*example\.com/, route => route.abort());
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const common = { tagIds: [], collectionIds: [], updatedAt: 1 };
    const assets = await Promise.all([["wide", 1600, 800], ["tall", 600, 1800], ["small", 64, 48], ["ultratall", 120, 6000], ["ultrawide", 6000, 120]].map(async ([id, width, height]) => {
      const canvas = document.createElement("canvas");
      canvas.width = Number(width); canvas.height = Number(height);
      const context = canvas.getContext("2d")!;
      context.fillStyle = id === "tall" ? "oklch(0.584477764 0.081003757 240.069917981)" : "oklch(0.758491244 0.09085318 81.374817162)";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "oklch(0.985103652 0 0)";
      context.fillRect(8, 8, canvas.width - 16, canvas.height - 16);
      const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), "image/png"));
      return { id: String(id), bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: blob.type, byteLength: blob.size, contentHash: String(id), createdAt: 1 };
    }));
    const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 180;
    canvas.getContext("2d")!.fillRect(0, 0, 320, 180);
    const stream = canvas.captureStream(10);
    const recording = await new Promise<Blob>(resolve => {
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      recorder.ondataavailable = event => chunks.push(event.data);
      recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
      recorder.start(); setTimeout(() => recorder.stop(), 200);
    });
    stream.getTracks().forEach(track => track.stop());
    const longTitle = "A deliberately long title that must remain on one line while the whole title is available in a tooltip. ".repeat(4).trim();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["items", "assets", "videoAssets"], "readwrite");
      for (const asset of assets) tx.objectStore("assets").put(asset);
      tx.objectStore("videoAssets").put({ id: "recording", mimeType: recording.type, byteLength: recording.size, blob: recording, createdAt: 1 });
      const items = [
        { id: "short", type: "note", title: "Short note", content: "A short piece of plain text." },
        { id: "gallery", type: "image", title: "", assetIds: ["wide", "tall", "small", "ultratall", "ultrawide"], sourceUrl: "", caption: "Saved context appears only below the gallery.\n" + "Extra readable context.\n".repeat(30) + "End of image notes." },
        { id: "long", type: "note", title: longTitle, content: "A long plain-text note.\n" + "A useful line of saved text.\n".repeat(100) + "End of long note." },
        { id: "markdown", type: "note", title: "Formatted note", format: "markdown", content: "## Saved heading\n\nSome **formatted** context.\n\n![Small reference](keepall-image:small)" },
        { id: "link", type: "link", url: "https://example.com/reference", title: "Saved link", previewAssetId: "wide", previewStatus: "ready", previewTitle: "", previewDescription: "Source description.", previewImageUrl: "", noteContent: "## Link context\n" + "Long attached notes.\n".repeat(30), noteFormat: "markdown" },
        { id: "video", type: "video", title: "Local recording", assetId: "recording", sourceFileName: "recording.webm", noteContent: "Video context." },
        { id: "broken-image", type: "image", title: "Missing image", assetIds: ["missing-asset"], sourceUrl: "", caption: "Saved notes remain readable." },
        { id: "broken-video", type: "video", title: "Missing video", assetId: "missing-video", sourceFileName: "missing.webm", noteContent: "Saved video notes remain readable." },
      ];
      items.forEach((item, index) => tx.objectStore("items").put({ ...common, ...item, createdAt: 1000 - index }));
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.locator('[data-item-id="short"]')).toBeVisible();
});

test("preview frame and controls stay fixed across media, captions, long notes, and missing files", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const dialog = page.locator(".library-quick-preview[role=dialog]");
  const frame = await dialog.boundingBox();
  const footer = await dialog.locator("footer").boundingBox();
  const assertFrame = async () => {
    expect(await dialog.boundingBox()).toEqual(frame);
    expect(await dialog.locator("footer").boundingBox()).toEqual(footer);
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth && node.scrollHeight <= node.clientHeight)).toBe(true);
    await expect(dialog.getByRole("button", { name: "Open full item" })).toBeInViewport();
  };
  const shortText = dialog.getByText("A short piece of plain text.");
  const text = await shortText.boundingBox();
  const body = await dialog.getByRole("region", { name: "Preview content", exact: true }).boundingBox();
  expect(Math.abs(text!.y + text!.height / 2 - body!.y - body!.height / 2)).toBeLessThan(2);
  await dialog.getByRole("button", { name: "Next item" }).click();
  await expect(dialog).toHaveAccessibleName("Image");
  await expect(dialog.getByRole("heading")).toHaveText("Image");
  const notes = dialog.getByRole("region", { name: "Image notes" });
  await expect(notes).toContainText("Saved context appears only below the gallery.");
  expect(await notes.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
  for (const slide of [0, 1, 2, 3, 4]) {
    const image = dialog.locator("[data-preview-media] img");
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    const box = await image.boundingBox();
    const stage = await dialog.locator("[data-preview-media]").boundingBox();
    expect(box!.height).toBeLessThanOrEqual(stage!.height + 1);
    expect(box!.width).toBeLessThanOrEqual(stage!.width + 1);
    expect(Math.abs(box!.x + box!.width / 2 - stage!.x - stage!.width / 2)).toBeLessThan(2);
    expect(Math.abs(box!.y + box!.height / 2 - stage!.y - stage!.height / 2)).toBeLessThan(2);
    const natural = await image.evaluate((node: HTMLImageElement) => ({ width: node.naturalWidth, height: node.naturalHeight }));
    expect(box!.width).toBeLessThanOrEqual(natural.width + 1);
    expect(box!.height).toBeLessThanOrEqual(natural.height + 1);
    expect(box!.width / box!.height).toBeCloseTo(natural.width / natural.height, 2);
    const galleryControls = await dialog.getByRole("group", { name: "Image sizing" }).boundingBox();
    const noteBox = await notes.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(galleryControls!.y + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(noteBox!.y + 1);
    expect(noteBox!.y + noteBox!.height).toBeLessThanOrEqual(footer!.y);
    await assertFrame();
    await page.screenshot({ path: testInfo.outputPath(`gallery-fit-${slide}.png`) });
    if (slide < 4) await dialog.getByRole("button", { name: "Next gallery image" }).click();
  }
  await expect(dialog.getByRole("button", { name: "Next gallery image" })).toBeDisabled();
  for (let step = 0; step < 3; step++) await dialog.getByRole("button", { name: "Previous gallery image" }).click();
  await dialog.getByRole("button", { name: "Scroll image", exact: true }).click();
  const imageViewport = dialog.getByRole("region", { name: "Image viewport" });
  await expect.poll(() => imageViewport.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
  const tallImage = imageViewport.locator("img");
  const naturalHeight = await tallImage.evaluate((node: HTMLImageElement) => node.naturalHeight);
  expect(naturalHeight).toBe(1800);
  await imageViewport.hover();
  await page.mouse.wheel(0, 2500);
  await expect.poll(() => imageViewport.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  const bottom = await tallImage.boundingBox();
  const bounds = await imageViewport.boundingBox();
  await expect.poll(() => imageViewport.evaluate(node => Math.abs(node.scrollHeight - node.clientHeight - node.scrollTop))).toBeLessThan(2);
  expect(Math.abs(bottom!.y + bottom!.height - bounds!.y - bounds!.height)).toBeLessThan(2);
  await imageViewport.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await expect(dialog).toHaveAccessibleName("Image");
  await assertFrame();
  await page.screenshot({ path: testInfo.outputPath("long-image-scroll.png") });
  await dialog.getByRole("button", { name: "Fit image", exact: true }).click();
  expect(await imageViewport.evaluate(node => node.scrollHeight <= node.clientHeight)).toBe(true);
  await notes.evaluate(node => node.scrollTop = node.scrollHeight);
  await expect(notes.getByText(/End of image notes/)).toBeVisible();
  await dialog.getByRole("button", { name: "Next item" }).click();
  const title = dialog.locator("header h2 span");
  expect(await title.evaluate(node => node.scrollWidth > node.clientWidth && getComputedStyle(node).whiteSpace === "nowrap")).toBe(true);
  await title.hover();
  await expect(page.getByRole("tooltip")).toHaveText(/A deliberately long title.*whole title/);
  await title.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("long-title-tooltip.png") });
  await dialog.getByRole("button", { name: "Next item" }).focus();
  await dialog.getByRole("button", { name: "Next item" }).hover();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  const longNote = dialog.getByText(/End of long note/);
  await longNote.evaluate(node => node.parentElement!.scrollTop = node.parentElement!.scrollHeight);
  await assertFrame();
  for (const title of ["Formatted note", "Saved link", "Local recording", "Missing image", "Missing video"]) {
    await dialog.getByRole("button", { name: "Next item" }).click();
    await expect(dialog).toHaveAccessibleName(title);
    if (title === "Local recording") {
      const video = dialog.locator("video");
      await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.readyState)).toBeGreaterThanOrEqual(1);
      const box = await video.boundingBox();
      const stage = await dialog.locator("[data-preview-media]").boundingBox();
      expect(box!.width).toBeLessThanOrEqual(stage!.width + 1);
      expect(box!.height).toBeLessThanOrEqual(stage!.height + 1);
      expect(box!.width / box!.height).toBeCloseTo(320 / 180, 2);
    }
    if (title === "Missing video") await expect(dialog.getByRole("alert")).toBeVisible();
    await assertFrame();
  }
  await expect(dialog.getByRole("button", { name: "Next item" })).toBeDisabled();
  expect(errors).toEqual([]);
});

test("preview keeps media and actions visible at narrow, wide, landscape, and zoom-equivalent widths", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const dialog = page.locator(".library-quick-preview[role=dialog]");
  await dialog.getByRole("button", { name: "Next item" }).click();
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1024, height: 900 }, { width: 1440, height: 900 }, { width: 844, height: 390 }, { width: 720, height: 450 }]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole("dialog", { name: "Sidebar navigation" })).toHaveCount(0);
    await expect(dialog).toBeInViewport();
    const frame = await dialog.boundingBox();
    expect(frame!.width).toBeLessThanOrEqual(viewport.width - 32);
    expect(frame!.height).toBeLessThanOrEqual(viewport.height - 32);
    for (const name of ["Close preview", "Next gallery image", "Next item", "Open full item"]) await expect(dialog.getByRole("button", { name, exact: true })).toBeInViewport();
    const media = await dialog.locator("[data-preview-media] img").boundingBox();
    expect(media!.height).toBeGreaterThan(20);
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth && node.scrollHeight <= node.clientHeight)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`preview-fit-${viewport.width}-${viewport.height}.png`) });
  }
});

test("preview survives RTL and expanded labels while title tooltips remain conditional", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 430, height: 844 });
  const sidebar = page.getByRole("dialog", { name: "Sidebar navigation" });
  if (await sidebar.isVisible()) await sidebar.getByRole("button", { name: "Close navigation" }).click();
  await page.evaluate(() => document.documentElement.dir = "rtl");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const dialog = page.locator(".library-quick-preview[role=dialog]");
  await dialog.locator("header h2 span").hover();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Open full item" }).evaluate(node => node.textContent = "Vollständigen Eintrag öffnen");
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await expect(dialog.getByRole("button", { name: "Vollständigen Eintrag öffnen" })).toBeInViewport();
  await dialog.getByRole("button", { name: "Next item" }).click();
  await expect(dialog).toHaveAccessibleName("Image");
  await page.screenshot({ path: testInfo.outputPath("preview-rtl.png") });
});
