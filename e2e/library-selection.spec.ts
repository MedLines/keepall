import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
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
      for (const [id, content] of [["alpha", "Alpha note"], ["beta", "Beta note"]]) {
        tx.objectStore("items").put({ id, title: content, type: "note", content, createdAt: 1, updatedAt: 1, tagIds: [], collectionIds: [] });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
});

for (const layout of ["Grid", "List"]) {
  test(`${layout} selection discloses hidden targets and preserves explicit choices through Trash`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.getByRole("button", { name: `${layout} view` }).click();
    const search = page.getByRole("searchbox", { name: "Search", exact: true });
    const select = async (name: string) => {
      const checkbox = page.getByRole("checkbox", { name: `Select ${name}`, exact: true });
      await checkbox.focus();
      await page.keyboard.press("Space");
      await expect(checkbox).toBeChecked();
    };
    await select("Alpha note");
    await select("Beta note");
    await search.fill("Alpha");
    const bulk = page.getByRole("region", { name: "Bulk actions" });
    const bulkAction = async (label: string) => {
      const trigger = bulk.getByRole("button", { name: "Selection actions: 2 selected" });
      if (await trigger.isVisible()) {
        await trigger.click();
        await page.getByRole("menuitem", { name: label, exact: true }).click();
      } else {
        await bulk.getByRole("button", { name: label === "Clear hidden selection" ? "Clear hidden" : label, exact: true }).click();
      }
    };
    await expect(bulk).toContainText("1 hidden");
    await page.screenshot({ path: testInfo.outputPath(`${layout.toLowerCase()}-hidden-selection.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileNavigation = page.getByRole("dialog", { name: "Sidebar navigation" });
    if (await mobileNavigation.isVisible()) {
      await page.keyboard.press("Escape");
      await expect(mobileNavigation).toHaveCount(0);
    }
    await expect(bulk).toContainText("1 hidden");
    await page.screenshot({ path: testInfo.outputPath(`${layout.toLowerCase()}-hidden-selection-mobile.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await bulkAction("Clear hidden selection");
    await expect(bulk).toContainText("1 selected");
    await search.fill("");
    await expect(page.getByRole("checkbox", { name: "Select Alpha note" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Select Beta note" })).not.toBeChecked();
    await select("Beta note");
    await search.fill("no matching item");
    await expect(bulk).toContainText("2 hidden");
    await search.fill("Alpha");
    await bulkAction("Move to Trash");
    const move = page.getByRole("dialog", { name: "Move 2 selected items to Trash" });
    await expect(move).toContainText("1 selected item is hidden");
    await move.getByRole("button", { name: "Move to Trash" }).click();
    await expect(bulk).toHaveCount(0);
    await page.goto("/?trash=1");
    await expect(page.locator("[data-item-id]")).toHaveCount(2);
    await select("Alpha note");
    await select("Beta note");
    await search.fill("Alpha");
    await expect(bulk).toContainText("1 hidden");
    await bulkAction("Delete permanently");
    const permanent = page.getByRole("dialog", { name: "Permanently delete selected items?" });
    await expect(permanent).toContainText("1 selected item is hidden");
    await permanent.getByRole("button", { name: "Delete permanently" }).click();
    await expect(page.getByText("Selected items permanently deleted.")).toBeVisible();
    await page.reload();
    await search.fill("");
    await expect(page.getByText("Trash is empty.", { exact: true })).toBeVisible();
    const remaining = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => { const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result); });
      const ids = await new Promise<IDBValidKey[]>((resolve) => { const request = db.transaction("items").objectStore("items").getAllKeys(); request.onsuccess = () => resolve(request.result); });
      db.close();
      return ids;
    });
    expect(remaining).toEqual([]);
  });
}

test("Trash Clear hidden keeps the excluded item after permanent deletion and reload", async ({ page }) => {
  test.setTimeout(60_000);
  const select = async (name: string) => {
    const checkbox = page.getByRole("checkbox", { name: `Select ${name}` });
    await checkbox.focus();
    await page.keyboard.press("Space");
  };
  await select("Alpha note");
  await select("Beta note");
  const bulk = page.getByRole("region", { name: "Bulk actions" });
  const choose = async (label: string) => {
    const trigger = bulk.getByRole("button", { name: /Selection actions:/ });
    if (await trigger.isVisible()) {
      await trigger.click();
      await page.getByRole("menuitem", { name: label, exact: true }).click();
    } else {
      await bulk.getByRole("button", { name: label === "Clear hidden selection" ? "Clear hidden" : label, exact: true }).click();
    }
  };
  await choose("Move to Trash");
  await page.getByRole("dialog", { name: "Move 2 selected items to Trash" }).getByRole("button", { name: "Move to Trash" }).click();
  await expect(bulk).toHaveCount(0);
  await page.goto("/?trash=1");
  await select("Alpha note");
  await select("Beta note");
  await page.getByRole("searchbox", { name: "Search" }).fill("Alpha");
  await expect(bulk).toContainText("1 hidden");
  await choose("Clear hidden selection");
  await expect(bulk).toContainText("1 selected");
  await choose("Delete permanently");
  const dialog = page.getByRole("dialog", { name: "Permanently delete selected items?" });
  await expect(dialog).toContainText("1 selected item");
  await expect(dialog).not.toContainText("hidden by search");
  await dialog.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByText("Selected items permanently deleted.")).toBeVisible();
  await page.reload();
  await page.getByRole("searchbox", { name: "Search" }).fill("");
  await expect(page.locator('[data-item-id="beta"]')).toBeVisible();
  await expect(page.locator('[data-item-id="alpha"]')).toHaveCount(0);
  const keys = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => { const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result); });
    const ids = await new Promise<IDBValidKey[]>((resolve) => { const request = db.transaction("items").objectStore("items").getAllKeys(); request.onsuccess = () => resolve(request.result); });
    db.close();
    return ids;
  });
  expect(keys).toEqual(["beta"]);
});

test("folder and tag overviews disclose hidden selection but a single-card delete names only its target", async ({ page }) => {
  test.setTimeout(60_000);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => { const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["collections", "tags"], "readwrite");
      for (const [id, name] of [["org-alpha", "Alpha"], ["org-beta", "Beta"]]) {
        tx.objectStore("collections").put({ id, name, createdAt: 1, pinnedItemIds: [] });
        tx.objectStore("tags").put({ id, name, createdAt: 1 });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  for (const kind of ["collections", "tags"] as const) {
    await page.goto(`/?${kind}=1`);
    const list = page.getByRole("list", { name: `Library ${kind}` });
    await expect(list.locator(".organization-card")).toHaveCount(2);
    for (const card of await list.locator(".organization-card").all()) {
      await card.getByRole("checkbox").focus();
      await page.keyboard.press("Space");
    }
    const search = page.getByRole("searchbox", { name: "Search" });
    await search.fill("Alpha");
    const bulk = page.getByRole("region", { name: "Bulk actions" });
    await expect(bulk).toContainText("1 hidden");
    const visibleCard = list.locator(".organization-card").first();
    await visibleCard.hover();
    await visibleCard.getByRole("button", { name: "Alpha actions" }).click();
    await page.getByRole("menuitem", { name: kind === "collections" ? "Delete folder" : "Delete tag" }).click();
    const single = page.getByRole("dialog", { name: kind === "collections" ? "Delete 1 folders?" : "Delete 1 tags?" });
    await expect(single).not.toContainText("hidden by search");
    await single.getByRole("button", { name: "Cancel" }).click();
    const trigger = bulk.getByRole("button", { name: /Selection actions:/ });
    if (await trigger.isVisible()) {
      await trigger.click();
      await page.getByRole("menuitem", { name: "Clear hidden selection" }).click();
    } else {
      await bulk.getByRole("button", { name: "Clear hidden" }).click();
    }
    await search.fill("");
    await expect(list.getByRole("checkbox", { name: "Select Alpha" })).toBeChecked();
    await expect(list.getByRole("checkbox", { name: "Select Beta" })).not.toBeChecked();
  }
});
