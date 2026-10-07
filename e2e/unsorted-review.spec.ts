import { test, expect, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

async function seed(page: Page, count = 3) {
  await page.addInitScript(() => localStorage.setItem("keepall-shell-panel-open", "closed"));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Save first item" })).toBeVisible();
  await page.evaluate(async (count) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["items", "collections", "tags"], "readwrite");
      for (let i = 0; i < count; i++) tx.objectStore("items").put({ id: `review-${i}`, type: "note", title: `Review item ${i + 1}`, content: `Saved note ${i + 1}. A long enough paragraph to preview while organizing the library.`, format: "plain", createdAt: 300 - i, updatedAt: 300 - i, collectionIds: [], tagIds: [] });
      tx.objectStore("collections").put({ id: "reading", name: "Reading", createdAt: 1, pinnedItemIds: [] });
      tx.objectStore("tags").put({ id: "reference", name: "Reference", createdAt: 1 });
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    }); db.close();
  }, count);
  await page.goto("/?unsorted=1");
  await expect(page.getByRole("button", { name: "Review Unsorted" })).toBeEnabled();
}

async function rows(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result); });
    const items = await new Promise<{ id: string; collectionIds: string[]; tagIds: string[]; deletedAt?: number }[]>(resolve => { const tx = db.transaction("items"); const request = tx.objectStore("items").getAll(); request.onsuccess = () => resolve(request.result); }); db.close(); return items;
  });
}

test("reviews tags, skips, files, deletion and Undo through the last queue position", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await seed(page);
  await page.getByRole("button", { name: "Review Unsorted" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Review item 1" })).toBeVisible();
  await dialog.getByLabel("Add tag", { exact: true }).fill("Reference");
  await dialog.getByLabel("Add tag", { exact: true }).press("Enter");
  await expect(page).not.toHaveURL(/items\//);
  await expect(dialog.getByText("Tags: Reference", { exact: true })).toBeVisible();
  await expect(dialog.getByText("0 of 3 reviewed · Item 1", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Skip", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).not.toHaveURL(/items\//);
  await expect(dialog.getByRole("heading", { name: "Review item 2" })).toBeVisible();
  await dialog.getByLabel("Move to collection").fill("Reading");
  await dialog.getByLabel("Move to collection").press("Enter");
  await expect(page).not.toHaveURL(/items\//);
  await expect(dialog.getByRole("heading", { name: "Review item 3" })).toBeVisible();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Review complete" })).toBeVisible();
  await expect(dialog.getByText("3 of 3 reviewed", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Review item 3" })).toBeVisible();
  await expect.poll(async () => (await rows(page)).find(row => row.id === "review-2")?.deletedAt).toBeUndefined();
  await dialog.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Review item 2" })).toBeVisible();
  await expect.poll(async () => (await rows(page)).find(row => row.id === "review-1")?.collectionIds).toEqual([]);
  await dialog.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Review item 1" })).toBeVisible();
  await dialog.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await rows(page)).find(row => row.id === "review-0")?.tagIds).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Review Unsorted" })).toBeFocused();
  expect(errors).toEqual([]);
});

test("review controls fit at 320px and a one-item queue keeps Undo after deletion", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await seed(page, 1);
  await page.getByRole("button", { name: "Review Unsorted" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Move to collection")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
  const bounds = await dialog.boundingBox(); expect(bounds!.width).toBeLessThanOrEqual(320);
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("review-mobile.png") });
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Review complete" })).toBeVisible();
  await dialog.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Review item 1" })).toBeVisible();
});

test("shortcut editing records, cancels, validates and saves before the app uses a new binding", async ({ page }, testInfo) => {
  await page.goto("/settings#keyboard-shortcuts-heading");
  const capture = page.getByRole("group", { name: "Shortcut for Save item", exact: true });
  const change = capture.getByRole("button", { name: "Change Save item shortcut", exact: true });
  await expect(change).toBeEnabled();
  await change.click();
  const recorder = page.getByRole("textbox", { name: "New shortcut for Save item", exact: true });
  await expect(recorder).toBeFocused();
  await recorder.press("j");
  await expect(capture.getByRole("alert")).toContainText("Use Alt/Option");
  await recorder.press("Alt+g");
  await expect(capture.getByRole("alert")).toContainText("already assigned");
  await expect(capture.getByRole("button", { name: "Save shortcut", exact: true })).toBeDisabled();
  await recorder.press("Alt+j");
  await expect(recorder).toHaveValue("Alt/Option+J");
  await expect(capture.locator("kbd")).toHaveText("Alt/Option+K");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await recorder.press("Escape");
  await expect(change).toBeFocused();
  await expect(capture.locator("kbd")).toHaveText("Alt/Option+K");
  await change.click();
  await recorder.press("Alt+j");
  await page.screenshot({ path: testInfo.outputPath("shortcut-recording-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await recorder.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("shortcut-recording-mobile.png") });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture.getByRole("button", { name: "Save shortcut", exact: true }).click();
  await expect(capture.locator("kbd")).toHaveText("Alt/Option+J");
  await expect(page.getByRole("status").filter({ hasText: "Save item shortcut saved." })).toBeVisible();
  await page.reload();
  await expect(capture.locator("kbd")).toHaveText("Alt/Option+J");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Save first item" })).toBeVisible();
  await page.keyboard.press("Alt+k"); await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("Alt+j"); await expect(page.getByRole("dialog", { name: "Save to Keepall" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Search", exact: true }).focus();
  await page.keyboard.press("Alt+j");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.type("draft"); await expect(page.getByRole("searchbox", { name: "Search", exact: true })).toHaveValue("draft");
});

test("active filters do not restrict the Unsorted review queue", async ({ page }) => {
  await seed(page);
  await page.goto("/?unsorted=1&type=image&q=missing");
  await page.getByRole("button", { name: "Review Unsorted" }).click();
  await expect(page.getByRole("dialog").getByText("0 of 3 reviewed · Item 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Review item 1" })).toBeVisible();
});

test("a new library offers Save, Import, and the tutorial, with empty Unsorted review disabled", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Save first item" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Import an existing library" })).toHaveAttribute("href", "/settings#backup-heading");
  await page.getByRole("link", { name: "Getting started", exact: true }).click();
  await expect(page).toHaveURL(/help\/getting-started/);
  await expect(page.getByRole("heading", { name: "Start your library", exact: true })).toBeVisible();
  await page.goto("/?unsorted=1");
  await expect(page.getByRole("button", { name: "Review Unsorted" })).toBeDisabled();
});

test("same-session tag and filing actions remain reversible through their exact history", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Review Unsorted" }).click();
  const dialog = page.getByRole("dialog");
  const tag = dialog.getByLabel("Add tag", { exact: true });
  await tag.fill("Reference"); await tag.press("Enter");
  await expect(dialog.getByText("Tags: Reference", { exact: true })).toBeVisible();
  await tag.fill("Second tag"); await tag.press("Enter");
  await expect(dialog.getByText("Tags: Reference, Second tag", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(dialog.getByText("Tags: Reference", { exact: true })).toBeVisible();
  await dialog.getByLabel("Move to collection").fill("Reading");
  await dialog.getByLabel("Move to collection").press("Enter");
  await expect(dialog.getByRole("heading", { name: "Review item 2" })).toBeVisible();
  await dialog.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Review item 1" })).toBeVisible();
  await dialog.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await rows(page)).find(row => row.id === "review-0")?.tagIds).toEqual([]);
  await expect(dialog.getByRole("alert")).toHaveCount(0);
});
