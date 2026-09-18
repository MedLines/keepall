import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("collection actions remain inside the same hovered sidebar row", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();

  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["collections", "tags"], "readwrite");
        tx.objectStore("collections").put({
          id: "collection-hover",
          name: "Design systems",
          createdAt: 1,
          pinnedItemIds: [],
        });
        tx.objectStore("tags").put({
          id: "tag-hover",
          name: "Typography",
          createdAt: 1,
        });
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  });
  await page.reload();

  const sidebar = page.getByRole("complementary", { name: "Sidebar" });
  const collection = sidebar.getByRole("button", {
    name: "Design systems",
    exact: true,
  });
  const collectionRow = collection.locator("..");
  const collectionActions = sidebar.getByRole("button", {
    name: "Design systems actions",
  });
  const tag = sidebar.getByRole("button", {
    name: "Tag Typography",
    exact: true,
  });

  await collection.hover();
  await expect(collectionRow).toHaveCSS("background-color", "rgb(234, 234, 231)");
  await expect(collectionRow).toHaveCSS("transition-duration", "0s");
  await expect(collectionActions).toHaveCSS("transition-duration", "0s");
  await collectionActions.hover();
  await expect(collectionRow).toHaveCSS("background-color", "rgb(234, 234, 231)");
  await tag.hover();
  await expect(tag).toHaveCSS("background-color", "rgb(234, 234, 231)");
  await expect(tag).toHaveCSS(
    "transition-property",
    /^(transform|transform, translate, scale, rotate)$/,
  );
});

test("long collection and tag lists scroll inside separate sidebar sections", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();

  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["collections", "tags"], "readwrite");
        for (let index = 1; index <= 36; index += 1) {
          const suffix = String(index).padStart(2, "0");
          tx.objectStore("collections").put({
            id: `collection-${suffix}`,
            name: `Collection ${suffix}`,
            createdAt: index,
            pinnedItemIds: [],
          });
          tx.objectStore("tags").put({
            id: `tag-${suffix}`,
            name: `Tag ${suffix}`,
            createdAt: index,
          });
        }
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  });
  await page.reload();

  const sidebar = page.getByRole("complementary", { name: "Sidebar" });
  const sectionScrolls = sidebar.locator(".library-sidebar-section-scroll");
  await expect(sectionScrolls).toHaveCount(2);
  const collectionsScroll = sectionScrolls.nth(0);
  const tagsScroll = sectionScrolls.nth(1);
  await expect(collectionsScroll).toHaveCSS("scrollbar-width", "thin");
  await expect(tagsScroll).toHaveCSS("scrollbar-width", "thin");
  await expect.poll(() => collectionsScroll.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  await expect.poll(() => tagsScroll.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  expect(await sidebar.evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true);

  const backup = sidebar.getByRole("button", { name: "Backup & restore" });
  const backupY = (await backup.boundingBox())!.y;
  const tagHeight = await tagsScroll.evaluate(element => element.clientHeight);
  await collectionsScroll.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(sidebar.getByRole("button", { name: "Collection 36", exact: true })).toBeVisible();
  expect(await tagsScroll.evaluate(element => element.scrollTop)).toBe(0);
  await expect(sidebar.getByRole("textbox", { name: "Search collections" })).toBeVisible();
  await expect(sidebar.getByRole("textbox", { name: "Search tags" })).toBeVisible();
  expect((await backup.boundingBox())!.y).toBe(backupY);

  await sidebar.getByRole("button", { name: "Collections", exact: true }).click();
  await expect(sectionScrolls).toHaveCount(1);
  await expect.poll(() => sectionScrolls.first().evaluate(element => element.clientHeight)).toBeGreaterThan(tagHeight);
  await expect(backup).toBeVisible();
});
