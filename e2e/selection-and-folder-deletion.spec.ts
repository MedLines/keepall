import { expect, test, type Locator, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

async function clickCardArea(page: Page, area: Locator) {
  await area.scrollIntoViewIfNeeded();
  const bounds = (await area.boundingBox())!;
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
}

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
      const tx = db.transaction(["collections", "tags", "items"], "readwrite");
      for (const [id, name] of [["folder", "Folder"], ["other", "Other"]]) {
        tx.objectStore("collections").put({ id, name, createdAt: 1, pinnedItemIds: [] });
        tx.objectStore("tags").put({ id, name, createdAt: 1 });
      }
      const base = { createdAt: 1, updatedAt: 1, collectionIds: ["folder"], tagIds: ["folder"] };
      tx.objectStore("items").put({ ...base, id: "note", type: "note", title: "Note", content: "Body text" });
      tx.objectStore("items").put({ ...base, id: "link", type: "link", title: "Article", url: "https://example.com/article", noteContent: "Saved article", previewTitle: "", previewDescription: "", previewStatus: "ready", previewRetry: "none", previewAttemptedAt: 1, previewImageUrl: "", previewAssetId: null });
      tx.objectStore("items").put({ ...base, id: "image", type: "image", title: "Image", assetIds: ["missing"], caption: "Image caption", sourceUrl: "" });
      tx.objectStore("items").put({ ...base, id: "video", type: "video", title: "Video", assetId: "missing", sourceFileName: "clip.mp4", noteContent: "" });
      tx.objectStore("items").put({ ...base, id: "trashed", type: "note", title: "Trashed", content: "Already trashed", deletedAt: 10 });
      tx.objectStore("items").put({ ...base, id: "unrelated", type: "note", title: "Unrelated", content: "Keep", collectionIds: ["other"], tagIds: ["other"] });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
});

for (const layout of ["Grid", "List"]) {
  for (const scope of ["", "?collection=folder", "?tag=folder"]) {
    test(`${layout} card clicks toggle selection in ${scope || "All items"}`, async ({ page, context }) => {
      await page.goto(`/${scope}`);
      await page.getByRole("button", { name: `${layout} view` }).click();
      if (layout === "List") await expect(page).toHaveURL(/layout=list/);
      const originalUrl = page.url();
      const note = page.locator('[data-item-id="note"]');
      await note.hover();
      await note.locator("[data-selection-indicator]").click();
      await expect(note.getByRole("checkbox")).toBeChecked();
      for (const id of ["link", "image", "video"]) {
        const card = page.locator(`[data-item-id="${id}"]`);
        await clickCardArea(page, card.locator(layout === "Grid" ? ".library-card-media" : ".library-list-thumbnail"));
        await expect(card.getByRole("checkbox")).toBeChecked();
        await clickCardArea(page, card.getByTitle(id === "link" ? "Article" : id === "image" ? "Image" : "Video", { exact: true }));
        await expect(card.getByRole("checkbox")).not.toBeChecked();
        const bounds = await card.boundingBox();
        await card.click({ position: { x: 4, y: bounds!.height / 2 } });
        await expect(card.getByRole("checkbox")).toBeChecked();
        expect(page.url()).toBe(originalUrl);
        expect(context.pages()).toHaveLength(1);
      }
      const noteTitle = layout === "Grid" ? note.locator("h2") : note.getByTitle("Note", { exact: true });
      await clickCardArea(page, noteTitle);
      await expect(note.getByRole("checkbox")).not.toBeChecked();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("region", { name: "Bulk actions" })).toHaveCount(0);
      await clickCardArea(page, noteTitle);
      await expect(page).toHaveURL(/\/items\/note/);
    });
  }
}

for (const kind of ["collections", "tags"]) {
  test(`${kind} overview card clicks select instead of opening`, async ({ page }) => {
    await page.goto(`/?${kind}=1`);
    const cards = page.getByRole("list", { name: `Library ${kind}` });
    const first = cards.locator(".organization-card").filter({ hasText: "Folder" });
    const second = cards.locator(".organization-card").filter({ hasText: "Other" });
    await first.hover();
    await first.locator("[data-selection-indicator]").click();
    await second.getByRole("link").click();
    await expect(second.getByRole("checkbox")).toBeChecked();
    await expect(page).toHaveURL(new RegExp(`${kind}=1`));
    await second.locator(".collection-folder-name").click();
    await expect(second.getByRole("checkbox")).not.toBeChecked();
  });
}

for (const entry of ["sidebar", "overview", "bulk"]) {
  for (const destination of ["Unsorted", "Trash"]) {
    test(`${entry} folder deletion moves its contents to ${destination}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.addInitScript(() => localStorage.setItem("keepall-shell-panel-open", "closed"));
      await page.goto(entry === "sidebar" ? "/" : "/?collections=1");
      if (entry === "sidebar") {
        await page.getByRole("button", { name: "Expand", exact: true }).click();
        await page.getByRole("complementary", { name: "Sidebar" }).getByRole("button", { name: "Folder actions", exact: true }).first().click();
        await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
      } else {
        const card = page.getByRole("list", { name: "Library collections" }).locator(".organization-card").filter({ hasText: "Folder" });
        await card.hover();
        if (entry === "overview") {
          await card.getByRole("button", { name: "Folder actions", exact: true }).click();
          await page.getByRole("menuitem", { name: "Delete folder", exact: true }).click();
        } else {
          await card.locator("[data-selection-indicator]").click();
          const bulk = page.getByRole("region", { name: "Bulk actions" });
          const trigger = bulk.getByRole("button", { name: /Selection actions:/ });
          if (await trigger.isVisible()) {
            await trigger.click();
            await page.getByRole("menuitem", { name: "Delete folders", exact: true }).click();
          } else await bulk.getByRole("button", { name: "Delete folders", exact: true }).click();
        }
      }
      const dialog = page.getByRole("dialog", { name: entry === "sidebar" ? "Delete collection?" : "Delete 1 folders?" });
      await expect(dialog.getByRole("radio", { name: /Move to Unsorted/ })).toBeChecked();
      const initialHeight = await dialog.evaluate(element => (element as HTMLElement).offsetHeight);
      await dialog.getByRole("radio", { name: new RegExp(`Move to ${destination}`) }).check();
      const options = dialog.locator(".collection-delete-option");
      await expect(options.first()).toHaveCSS("border-radius", "8px");
      const optionHeights = await options.evaluateAll(elements => elements.map(element => (element as HTMLElement).offsetHeight));
      expect(optionHeights[0]).toBe(optionHeights[1]);
      expect(await dialog.evaluate(element => (element as HTMLElement).offsetHeight)).toBe(initialHeight);
      await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeInViewport();
      await expect(dialog.getByRole("button", { name: /Delete collection|Delete folders/ })).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath(`delete-${entry}-${destination.toLowerCase()}.png`) });
      await dialog.getByRole("button", { name: /Delete collection|Delete folders/ }).click();
      await expect(dialog).toBeHidden();
      await page.reload();
      const result = await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result); });
        const read = <T,>(store: string) => new Promise<T[]>(resolve => { const request = db.transaction(store).objectStore(store).getAll(); request.onsuccess = () => resolve(request.result); });
        const collections = await read<{ id: string }>("collections");
        const items = await read<{ id: string; deletedAt?: number; collectionIds: string[]; tagIds: string[] }>("items");
        db.close();
        return { collections, items };
      });
      expect(result.collections.map(collection => collection.id)).toEqual(["other"]);
      for (const item of result.items.filter(item => ["note", "link", "image", "video"].includes(item.id))) {
        expect(item.collectionIds).toEqual([]);
        expect(item.tagIds).toEqual(["folder"]);
        expect(item.deletedAt).toEqual(destination === "Trash" ? expect.any(Number) : undefined);
      }
      expect(result.items.find(item => item.id === "trashed")?.deletedAt).toBe(10);
      expect(result.items.find(item => item.id === "unrelated")?.deletedAt).toBeUndefined();
      await page.goto(destination === "Trash" ? "/?trash=1" : "/?unsorted=1");
      const navigation = page.getByRole("dialog", { name: "Sidebar navigation" });
      if (await navigation.isVisible()) await navigation.getByRole("button", { name: "Close navigation", exact: true }).click();
      await expect(page.locator('[data-item-id="note"]')).toBeVisible();
    });
  }
}

for (const layout of ["Grid", "List"]) {
  test(`${layout} embedded folder, tag and Trash controls select the card without acting or hovering`, async ({ page }) => {
    await page.getByRole("button", { name: `${layout} view`, exact: true }).click();
    const note = page.locator('[data-item-id="note"]');
    await note.hover();
    await note.locator("[data-selection-indicator]").click();
    const image = page.locator('[data-item-id="image"]');
    const folder = image.locator('button[title="Folder"]').first();
    const tag = layout === "Grid" ? image.locator(".library-card-tag-control button") : image.locator('ul[aria-label="Tags"] button').first();
    for (const control of [folder, tag]) {
      await expect(control).toHaveCSS("pointer-events", "none");
      const background = await control.evaluate(element => getComputedStyle(element).backgroundColor);
      const bounds = (await control.boundingBox())!;
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      expect(await control.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(background);
      await clickCardArea(page, control);
    }
    await expect(image.getByRole("checkbox")).not.toBeChecked();
    await expect(page).not.toHaveURL(/collection=|tag=/);
    await page.goto("/?trash=1");
    const trashed = page.locator('[data-item-id="trashed"]');
    await trashed.hover();
    await trashed.locator("[data-selection-indicator]").click();
    const restore = trashed.locator("button").filter({ hasText: /^Restore$/ });
    await expect(restore).toHaveCSS("pointer-events", "none");
    await clickCardArea(page, restore);
    await expect(trashed.getByRole("checkbox")).not.toBeChecked();
    await expect(trashed).toBeVisible();
    await trashed.locator("[data-selection-indicator]").click();
    await clickCardArea(page, trashed.locator("button").filter({ hasText: /^Delete permanently$/ }));
    await expect(trashed.getByRole("checkbox")).not.toBeChecked();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trashed).toBeVisible();
  });
}
