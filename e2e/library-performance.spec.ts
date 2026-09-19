import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __keepallObjectUrlCounts?: { created: number; revoked: number };
  }
}

test.use({ serviceWorkers: "block" });

async function seedMeasuredLibrary(page: Page, options?: { imageOnly?: boolean }) {
  await page.evaluate(async ({ imageOnly }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 540;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#b8d4ca";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((value) => resolve(value!), "image/png"),
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());

    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["items", "assets", "collections"], "readwrite");
        tx.objectStore("assets").put({
          id: "shared-preview",
          bytes,
          mimeType: "image/png",
          byteLength: bytes.length,
          contentHash: "shared-performance-fixture",
          createdAt: 1,
        });
        for (const [collectionId, name] of [
          ["short", "Short cards"],
          ["mixed", "Mixed cards"],
        ] as const) {
          tx.objectStore("collections").put({
            id: collectionId,
            name,
            createdAt: 1,
            pinnedItemIds: [],
          });
          for (let index = 0; index < 90; index += 1) {
            const common = {
              id: `${collectionId}-${index}`,
              createdAt: 10_000 - index,
              updatedAt: 1,
              collectionIds: [collectionId],
              tagIds: [],
            };
            if (imageOnly || (collectionId === "mixed" && index % 3 === 0)) {
              tx.objectStore("items").put({
                ...common,
                type: "image",
                title: `Reference ${index}`,
                assetIds: ["shared-preview"],
                caption: index % 2 === 0 ? "Tall visual reference" : "",
                sourceUrl: "",
              });
            } else {
              tx.objectStore("items").put({
                ...common,
                type: "note",
                title: `${name} ${index}`,
                content:
                  collectionId === "short"
                    ? "Small note."
                    : "A variable-height design note. ".repeat(1 + (index % 12)),
              });
            }
          }
        }
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }, { imageOnly: options?.imageOnly ?? false });
  await page.reload();
}

test("sidebar toggles do not animate the masonry container width", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();

  const sidebar = page.getByRole("complementary", { name: "Sidebar" });
  await expect(sidebar).toBeVisible();
  await expect(sidebar).not.toHaveCSS("transition-property", /(^|, )width(,|$)/);

  await page.getByRole("button", { name: "Collapse" }).click();
  await expect(sidebar).toHaveCSS("width", "56px");
  await page.getByRole("button", { name: "Expand" }).click();
  await expect(sidebar).toHaveCSS("width", "256px");
});

test("collection switches keep one stable card for every rendered item", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await seedMeasuredLibrary(page);

  const sidebar = page.getByRole("complementary", { name: "Sidebar" });
  await sidebar.getByRole("button", { name: "Short cards", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Short cards 0" })).toBeVisible();
  await sidebar.getByRole("button", { name: "Mixed cards", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mixed cards", exact: true })).toBeVisible();
  await expect(page.locator(".library-item-root").first()).toBeVisible();

  const identity = await page.locator(".library-item-root").evaluateAll((nodes) => {
    const ids = nodes.map((node) => node.getAttribute("data-item-id"));
    return { count: ids.length, populated: ids.filter(Boolean).length, unique: new Set(ids).size };
  });
  expect(identity.populated).toBe(identity.count);
  expect(identity.unique).toBe(identity.count);

  const motion = await page.locator("[aria-label='Library items']").evaluate(async (grid) => {
    const samples: Record<string, number>[] = [];
    for (let frame = 0; frame < 12; frame += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      samples.push(Object.fromEntries(
        [...grid.querySelectorAll<HTMLElement>(":scope > .library-item-root")]
          .map((card) => [card.dataset.itemId ?? "", card.getBoundingClientRect().top]),
      ));
    }
    let largestLateShift = 0;
    for (let frame = 4; frame < samples.length; frame += 1) {
      for (const [id, top] of Object.entries(samples[frame])) {
        const previous = samples[frame - 1][id];
        if (previous !== undefined) largestLateShift = Math.max(largestLateShift, Math.abs(top - previous));
      }
    }
    return largestLateShift;
  });
  expect(motion).toBeLessThanOrEqual(1);
});

test("virtualized cards share one object URL for the same local asset", async ({ page }) => {
  await page.addInitScript(() => {
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    window.__keepallObjectUrlCounts = { created: 0, revoked: 0 };
    URL.createObjectURL = (value) => {
      window.__keepallObjectUrlCounts!.created += 1;
      return create(value);
    };
    URL.revokeObjectURL = (value) => {
      window.__keepallObjectUrlCounts!.revoked += 1;
      revoke(value);
    };
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await seedMeasuredLibrary(page, { imageOnly: true });

  const sidebar = page.getByRole("complementary", { name: "Sidebar" });
  await sidebar.getByRole("button", { name: "Mixed cards", exact: true }).click();
  await expect(page.locator(".library-card img").first()).toBeVisible();
  const main = page.getByRole("main");
  await main.evaluate((node) => node.scrollTo(0, node.scrollHeight));
  await expect.poll(() => main.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  await main.evaluate((node) => node.scrollTo(0, 0));
  await expect.poll(() => main.evaluate((node) => node.scrollTop)).toBe(0);

  await expect.poll(() => page.evaluate(() => window.__keepallObjectUrlCounts)).toEqual({
    created: 1,
    revoked: 0,
  });
});

test("cards never load third-party preview or favicon URLs", async ({ page }) => {
  const externalImageRequests: string[] = [];
  await page.route(/https:\/\/(cdn\.example\.com|www\.google\.com)\/.*/, async (route) => {
    externalImageRequests.push(route.request().url());
    await route.abort();
  });
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("items", "readwrite");
      tx.objectStore("items").put({
        id: "remote-preview",
        type: "link",
        title: "Local-only preview",
        url: "https://example.com/article",
        previewStatus: "ready",
        previewTitle: "",
        previewDescription: "",
        previewImageUrl: "https://cdn.example.com/preview.png",
        previewAssetId: null,
        previewRetry: "none",
        previewAttemptedAt: 1,
        collectionIds: [],
        tagIds: [],
        createdAt: 1,
        updatedAt: 1,
      });
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Local-only preview" })).toBeVisible();
  await page.waitForTimeout(100);

  expect(externalImageRequests).toEqual([]);
  await expect(page.locator('.library-card img[src^="http"]')).toHaveCount(0);
});
