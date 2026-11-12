import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.route("https://www.google.com/s2/favicons**", route => route.abort());
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Start your library", exact: true })).toBeVisible();
  // This database belongs to Playwright's disposable browser context.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    async function png(width: number, height: number, color: string) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d")!;
      context.fillStyle = color;
      context.fillRect(0, 0, width, height);
      const blob = await new Promise<Blob>(resolve => canvas.toBlob(result => resolve(result!), "image/png"));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return { bytes, mimeType: "image/png", byteLength: bytes.length, createdAt: 1 };
    }
    const common = {
      createdAt: 1, updatedAt: 1, collectionIds: [], tagIds: [], previewStatus: "ready", previewTitle: "",
      previewDescription: "", previewImageUrl: "", previewRetry: "none", previewAttemptedAt: 1,
    };
    const shot = (assetId: string, capturedAt: number) => ({ assetId, capturedAt, width: 1600, height: 1000 });
    const assets = [["og", await png(1200, 630, "#c7d2fe")], ["s1", await png(1600, 1000, "#f5f5f4")], ["s2", await png(1600, 1000, "#fef3c7")]] as const;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["items", "assets"], "readwrite");
      for (const [id, asset] of assets) tx.objectStore("assets").put({ ...asset, id, contentHash: id });
      tx.objectStore("items").put({ ...common, id: "folio", type: "link", title: "Folio", url: "https://folio.example/", previewAssetId: "og", screenshots: [shot("s1", 5), shot("s2", 6)], createdAt: 3 });
      tx.objectStore("items").put({ ...common, id: "shots-only", type: "link", title: "Shots only", url: "https://shots.example/", previewAssetId: null, screenshots: [shot("s2", 7)], createdAt: 2 });
      tx.objectStore("items").put({ ...common, id: "plain", type: "link", title: "Plain", url: "https://plain.example/", previewAssetId: "og", createdAt: 1 });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.locator('[data-item-id="folio"]')).toBeVisible();
});

test("cards keep the page preview as cover and count screenshots", async ({ page }) => {
  await expect(page.locator('[data-item-id="folio"]').getByRole("img", { name: "Link with 2 screenshots" })).toBeVisible();
  await expect(page.locator('[data-item-id="shots-only"]').getByRole("img", { name: "Link with 1 screenshot" })).toBeVisible();
  await expect(page.locator('[data-item-id="plain"]').getByRole("img", { name: "Link", exact: true })).toBeVisible();
  // A link without a page preview falls back to its first screenshot.
  await expect(page.locator('[data-item-id="shots-only"] .library-card-media img').first()).toBeVisible();
});

test("item page chooses a screenshot as cover and removes screenshots", async ({ page }) => {
  await page.goto("/items/folio");
  const section = page.getByRole("region", { name: /Screenshots/ });
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole("button", { name: /^Screenshot \d/ })).toHaveCount(2);
  await expect(page.getByRole("region", { name: /Screenshots/ }).getByRole("button", { name: "Screenshot 1" })).toHaveAttribute("aria-pressed", "true");

  await section.getByRole("button", { name: "Screenshot 2" }).click();
  await section.getByRole("button", { name: "Use as cover" }).click();
  await expect(section.getByRole("button", { name: "Use automatic cover" })).toBeVisible();
  expect(await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const row = await new Promise<{ coverAssetId?: string }>(resolve => {
      const request = db.transaction("items").objectStore("items").get("folio");
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return row.coverAssetId;
  })).toBe("s2");

  await section.getByRole("button", { name: "Screenshot 1" }).click();
  await section.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("button", { name: "Remove screenshot" }).click();
  await expect(section.getByRole("button", { name: /^Screenshot \d/ })).toHaveCount(1);
  await expect(section.getByText("1", { exact: true })).toBeVisible();
  await expect(section.getByRole("button", { name: "Use automatic cover" })).toBeVisible();

  await section.getByRole("button", { name: "Use automatic cover" }).click();
  await section.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("button", { name: "Remove screenshot" }).click();
  await expect(page.getByRole("region", { name: /Screenshots/ })).toHaveCount(0);
});

test("quick preview switches between the page preview and screenshots", async ({ page }) => {
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const dialog = page.locator(".library-quick-preview[role=dialog]");
  const strip = dialog.getByRole("group", { name: "Link images" });
  await expect(strip.getByRole("button")).toHaveCount(3);
  await expect(strip.getByRole("button", { name: "Page preview" })).toHaveAttribute("aria-pressed", "true");
  await strip.getByRole("button", { name: "Screenshot 2" }).click();
  await expect(strip.getByRole("button", { name: "Screenshot 2" })).toHaveAttribute("aria-pressed", "true");

  // Links without screenshots keep the existing preview layout.
  await dialog.getByRole("button", { name: "Next item" }).click();
  await dialog.getByRole("button", { name: "Next item" }).click();
  await expect(dialog.getByRole("group", { name: "Link images" })).toHaveCount(0);
});

test("clicking a screenshot opens the shared full-screen viewer and steps through captures", async ({ page }) => {
  await page.goto("/items/folio");
  const section = page.getByRole("region", { name: /Screenshots/ });
  await section.getByRole("button", { name: "View screenshot full screen" }).click();
  const viewer = page.getByRole("dialog", { name: "Focused image viewer" });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByLabel("Image 1 of 2")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(viewer.getByLabel("Image 2 of 2")).toBeVisible();
  await viewer.getByRole("button", { name: "Zoom in image" }).click();
  await expect(viewer.getByRole("button", { name: "Zoom out image" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
  // Stepping in the viewer moves the section's selection with it.
  await expect(section.getByRole("button", { name: "Screenshot 2" })).toHaveAttribute("aria-pressed", "true");
});
