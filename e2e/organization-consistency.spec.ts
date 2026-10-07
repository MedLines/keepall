import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Start your library", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction(["items", "collections", "tags"], "readwrite");
    for (const [id, name] of [["reading", "Reading"], ["writing", "Writing"]]) {
      transaction.objectStore("collections").put({ id, name, createdAt: 1, pinnedItemIds: [] });
    }
    for (const [id, name] of [["work", "Work"], ["reference", "Reference"], ["later", "Later"]]) {
      transaction.objectStore("tags").put({ id, name, createdAt: 1 });
    }
    const base = { type: "note", createdAt: 1, updatedAt: 1, content: "Saved content" };
    transaction.objectStore("items").put({ ...base, id: "one", title: "One", collectionIds: ["reading"], tagIds: ["work", "reference"] });
    transaction.objectStore("items").put({ ...base, id: "two", title: "Two", collectionIds: ["writing"], tagIds: ["reference"] });
    transaction.objectStore("items").put({ ...base, id: "other", title: "Other", collectionIds: ["writing"], tagIds: ["reference"] });
    transaction.objectStore("items").put({ ...base, type: "link", id: "link", title: "Legacy link", url: "https://example.com", collectionIds: ["reading"], tagIds: ["reference"], previewStatus: "ready", previewRetry: "none" });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  });
  await page.reload();
});

async function closeNavigation(page: Page) {
  const close = page.getByRole("button", { name: "Close navigation", exact: true });
  if (await close.isVisible()) await close.click();
}

async function readItems(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const items = await new Promise<Array<{ id: string; tagIds: string[]; collectionIds: string[] }>>((resolve, reject) => {
      const request = db.transaction("items").objectStore("items").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return items;
  });
}

for (const width of [320, 1440]) {
  test(`selection organizer shares chips and handles mixed and hidden items at ${width}px`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await closeNavigation(page);
    for (const id of ["one", "two"]) {
      const card = page.locator(`[data-item-id="${id}"]`);
      await card.getByRole("checkbox").focus();
      await card.getByRole("checkbox").press("Space");
    }
    await page.getByRole("searchbox", { name: "Search", exact: true }).fill("One");
    const bulk = page.getByRole("region", { name: "Bulk actions" });
    const organize = bulk.getByRole("button", { name: "Organize", exact: true });
    if (await organize.isVisible()) await organize.click();
    else {
      await bulk.getByRole("button", { name: "Selection actions: 2 selected", exact: true }).click();
      await page.getByRole("menuitem", { name: "Organize", exact: true }).click();
    }
    const drawer = page.getByRole("dialog", { name: "Organize 2 selected items", exact: true });
    await expect(drawer).toContainText("including 1 hidden");
    await expect(drawer).toContainText("Selected items are in different collections.");
    await expect(drawer.getByRole("button", { name: "Unsorted", exact: true })).toHaveAttribute("aria-pressed", "false");
    const partial = drawer.getByRole("button", { name: "Apply tag Work to all selected items" });
    await expect(partial).toHaveAttribute("aria-pressed", "mixed");
    await partial.click();
    await expect(partial).toHaveCount(0);
    await expect(drawer.getByRole("button", { name: "Remove tag Work from selection" })).toBeEnabled();
    await drawer.getByRole("button", { name: "Browse all collections" }).click();
    const picker = page.getByRole("dialog", { name: "Choose a collection" });
    await picker.getByRole("button", { name: "Reading", exact: true }).click();
    await expect(drawer.getByRole("button", { name: "Reading", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(drawer.getByText("Selected items are in different collections.")).toHaveCount(0);
    await drawer.getByRole("textbox", { name: "Add tag to selection" }).fill("Shared");
    await drawer.getByRole("button", { name: "Create tag “Shared”", exact: true }).click();
    await expect(drawer.getByRole("button", { name: "Remove tag Shared from selection" })).toBeEnabled();
    expect(await drawer.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`shared-organizer-${width}.png`) });
    await drawer.getByRole("button", { name: "Remove all tags", exact: true }).click();
    await expect(drawer.getByRole("list", { name: "Selected tags" })).toHaveCount(0);
    await drawer.getByRole("button", { name: "Unsorted", exact: true }).click();
    await expect(drawer.getByRole("button", { name: "Unsorted", exact: true })).toHaveAttribute("aria-pressed", "true");
    await drawer.getByRole("button", { name: "Done", exact: true }).click();
    await expect(bulk).toContainText("2 selected");
    await page.reload();
    const items = await readItems(page);
    for (const id of ["one", "two"]) {
      expect(items.find(item => item.id === id)).toMatchObject({ tagIds: [], collectionIds: [] });
    }
    expect(items.find(item => item.id === "other")).toMatchObject({ tagIds: ["reference"], collectionIds: ["writing"] });
    expect(errors).toEqual([]);
  });
}

test("legacy detail and its nested pickers use the shared organizer and preserve parent focus", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await closeNavigation(page);
  await page.goto("/?item=link");
  const detail = page.getByRole("dialog", { name: "Legacy link", exact: true });
  const organize = detail.getByRole("button", { name: "Organize", exact: true });
  await organize.click();
  const drawer = page.getByRole("dialog", { name: "Organize Legacy link", exact: true });
  await expect(drawer.getByRole("textbox", { name: "Add tag" })).toBeVisible();
  await drawer.getByRole("button", { name: "Browse all tags" }).click();
  await expect(page.getByRole("dialog", { name: "Choose a tag", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Choose a tag", exact: true })).toBeHidden();
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "Done", exact: true }).click();
  await expect(drawer).toBeHidden();
  await expect(detail).toBeVisible();
  await expect(organize).toBeFocused();
});
