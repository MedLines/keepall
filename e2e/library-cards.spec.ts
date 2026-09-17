import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.route("https://www.google.com/s2/favicons**", route => route.abort());
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  // This database belongs to Playwright's disposable browser context.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 240;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#d9e7e2";
    context.fillRect(0, 0, 600, 240);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!)));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const base = { createdAt: 1, updatedAt: 1, collectionIds: ["c"], tagIds: ["t"] };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["items", "assets", "collections", "tags"], "readwrite");
      tx.objectStore("collections").put({ id: "c", name: "UI inspiration", createdAt: 1, pinnedItemIds: [] });
      tx.objectStore("tags").put({ id: "t", name: "minimal", createdAt: 1 });
      tx.objectStore("assets").put({ id: "asset", bytes, mimeType: "image/png", byteLength: bytes.length, contentHash: "fixture", createdAt: 1 });
      tx.objectStore("items").put({ ...base, id: "image", type: "image", title: "Customer support", assetIds: ["asset"], caption: "", sourceUrl: "", createdAt: 4 });
      tx.objectStore("items").put({ ...base, id: "note", type: "note", title: "Design notes", content: "Keep the card quiet.\n\nLet the image lead.", createdAt: 3 });
      const link = { ...base, type: "link", title: "Footer reference", url: "https://example.com/footer", previewTitle: "", previewDescription: "A spacious footer for a portfolio.", previewStatus: "ready", previewRetry: "none", previewAttemptedAt: 1, previewImageUrl: "", previewAssetId: "asset" };
      tx.objectStore("items").put({ ...link, id: "link", createdAt: 2 });
      tx.objectStore("items").put({ ...link, id: "fallback", title: "", url: "https://example.com/fallback", previewAssetId: null });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
});

test("mixed cards preserve image proportions, readable notes and compact fallbacks", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const image = page.locator(".library-card").filter({ has: page.getByRole("heading", { name: "Customer support" }) });
  const picture = image.locator("img");
  await expect(picture).toBeVisible();
  await expect.poll(() => picture.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBe(600);
  const bounds = await picture.boundingBox();
  expect(bounds!.width / bounds!.height).toBeCloseTo(2.5, 1);
  const note = page.locator(".library-card").filter({ has: page.getByRole("heading", { name: "Design notes" }) });
  await expect(note.locator("img")).toHaveCount(0);
  await expect(note.getByRole("button", { name: "Read Design notes" })).toContainText("Let the image lead.");
  const link = page.locator(".library-card").filter({ has: page.getByRole("heading", { name: "Footer reference" }) });
  await expect(link.locator('img[src^="blob:"]')).toBeVisible();
  await expect(link.getByText("A spacious footer for a portfolio.")).toBeVisible();
  const fallback = page.locator(".library-card").filter({ has: page.getByRole("heading", { name: "example.com/fallback" }) });
  await expect(fallback.locator("img")).toHaveCount(0);
  await expect(fallback).toHaveCSS("border-radius", "20px");
  expect((await fallback.boundingBox())!.height).toBeLessThan(200);
  await page.getByRole("combobox", { name: "Theme" }).selectOption("dark");
  await expect(fallback).toHaveCSS("background-image", /linear-gradient/);
  await expect(fallback).toHaveCSS("box-shadow", /255, 255, 255/);
});

test("desktop card actions reveal on hover or focus and stay visible while open", async ({ page }) => {
  const card = page.locator(".library-card").first();
  const actions = card.locator("details");
  const trigger = actions.locator("summary");
  await page.mouse.move(0, 0);
  await expect(actions).toHaveCSS("opacity", "0");
  await card.hover();
  await expect(actions).toHaveCSS("opacity", "1");
  await trigger.click();
  await page.mouse.move(0, 0);
  await page.getByRole("button", { name: "All items", exact: true }).focus();
  await expect(actions).toHaveCSS("opacity", "1");
  await trigger.focus();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(actions).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "All items", exact: true }).focus();
  await expect(actions).toHaveCSS("opacity", "0");
  await trigger.focus();
  await expect(actions).toHaveCSS("opacity", "1");
});

test("image inset outlines follow the rounded preview in both themes", async ({ page }) => {
  const card = page.locator(".library-card").first();
  const image = card.locator("img");
  await expect(image).toBeVisible();
  await expect(card).toHaveCSS("border-radius", "20px");
  await expect(card).toHaveCSS("padding", "8px");
  await expect(image).toHaveCSS("border-radius", "12px");
  await expect(image).toHaveCSS("outline-offset", "-1px");
  await expect(image).toHaveCSS("outline-width", "1px");
  await page.getByRole("combobox", { name: "Theme" }).selectOption("light");
  await expect(image).toHaveCSS("outline-color", "rgba(0, 0, 0, 0.1)");
  await page.getByRole("combobox", { name: "Theme" }).selectOption("dark");
  await expect(image).toHaveCSS("outline-color", "rgba(255, 255, 255, 0.1)");
});

test("card actions, tag disclosure, selection and collection context work", async ({ page }) => {
  const note = page.locator(".library-card").filter({ hasText: "Design notes" });
  await note.getByRole("button", { name: "1 tag" }).focus();
  await page.keyboard.press("Enter");
  await expect(note.getByRole("button", { name: "minimal", exact: true })).toBeVisible();
  await note.getByRole("button", { name: "minimal", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(note.getByRole("button", { name: "1 tag" })).toBeFocused();
  await note.locator("summary").click();
  await note.getByRole("button", { name: "Edit", exact: true }).click();
  await note.getByRole("button", { name: "Cancel edit" }).click();
  await expect(note.getByRole("button", { name: "Edit", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(note.locator("summary")).toBeFocused();
  await page.keyboard.press("Enter");
  await note.getByRole("button", { name: "Edit", exact: true }).click();
  await note.getByLabel("Note content").fill("Updated note body");
  await note.getByRole("button", { name: "Save note" }).click();
  await expect(note.getByRole("button", { name: "Read Design notes" })).toContainText("Updated note body");
  await note.hover();
  await note.getByRole("checkbox").check();
  await expect(note.getByRole("checkbox")).toBeChecked();
  await note.getByRole("checkbox").uncheck();
  await page.getByRole("button", { name: "UI inspiration", exact: true }).click();
  await expect(note.getByRole("list", { name: "Collections" })).toHaveCount(0);
  await note.hover();
  await note.locator("summary").click();
  await note.getByRole("button", { name: "Pin", exact: true }).click();
  await expect(note.getByRole("button", { name: "Unpin", exact: true })).toBeVisible();
});

test("a large library keeps measured row virtualization and reaches the last card", async ({ page }) => {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("items", "readwrite");
      for (let i = 0; i < 120; i++) tx.objectStore("items").put({ id: `extra-${i}`, type: "note", title: `Reference ${i}`, content: "Design observation. ".repeat(1 + i % 15), createdAt: 1000 + i, updatedAt: 1, collectionIds: [], tagIds: [] });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Reference 119", exact: true })).toBeVisible();
  expect(await page.locator(".library-card").count()).toBeLessThan(124);
  const main = page.locator("main");
  // Scrolling changes the total estimate as variable-height rows are measured.
  await expect(async () => {
    await main.evaluate(el => el.scrollTo(0, el.scrollHeight));
    await expect(page.getByRole("heading", { name: "example.com/fallback", exact: true })).toBeInViewport();
  }).toPass();
  expect(await page.locator(".library-card").count()).toBeLessThan(124);
  expect(await main.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

for (const width of [320, 768, 1024]) {
  test(`cards fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(".library-card").first()).toBeVisible();
    await expect.poll(() => page.locator("main").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test.describe("touch card controls", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("actions remain visible and open without hover", async ({ page }) => {
    const closeNavigation = page.getByRole("button", { name: "Close navigation", exact: true });
    await expect(closeNavigation).toBeVisible();
    await closeNavigation.tap();
    const card = page.locator(".library-card").first();
    await expect(card.locator("details")).toHaveCSS("opacity", "1");
    await card.locator("summary").tap();
    await expect(card.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    await expect(card.getByRole("button", { name: "Delete", exact: true })).toBeInViewport();
  });
});

test("action controls mirror in RTL and respect reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => { document.documentElement.dir = "rtl"; });
  const card = page.locator(".library-card").first();
  await card.hover();
  const actions = card.locator("details");
  await expect(actions).toHaveCSS("transition-duration", "0s");
  const cardBox = (await card.boundingBox())!;
  const triggerBox = (await actions.locator("summary").boundingBox())!;
  expect(triggerBox.x - cardBox.x).toBeCloseTo(12, 0);
  await actions.locator("summary").click();
  await expect(card.getByRole("button", { name: "Edit", exact: true })).toBeInViewport();
});
