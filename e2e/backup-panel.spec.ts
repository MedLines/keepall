import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

test.use({ serviceWorkers: "block" });

test("settings owns backup and import recovery", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to library" })).toHaveAttribute(
    "href",
    "/",
  );

  const backup = page.getByRole("region", { name: "Backup" });
  const importSection = page.getByRole("region", { name: "Import" });
  const backupInput = backup.locator('input[accept*="application/json"]');
  await expect(backup.getByRole("button", { name: "Export backup" })).toBeVisible();
  await expect(importSection.getByRole("button", { name: "Import bookmarks" })).toBeVisible();
  const storage = page.getByRole("region", { name: "Storage" });
  await expect(storage).toContainText("Planned");
  await expect(storage.getByText("Site storage used")).toBeVisible();
  await expect(storage.getByRole("button", { name: "Refresh storage status" })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("settings-desktop.png"), fullPage: true });

  for (const theme of ["light", "dark"] as const) {
    if (await page.locator("html").getAttribute("data-theme") !== theme) {
      await page.getByRole("button", { name: "Theme", exact: true }).click();
    }
    await backupInput.setInputFiles({
      name: "library.keepall.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ format: "keepall", version: 7, exportedAt: 123, items: [], tags: [], collections: [], assets: [], preferences: { pinnedCollectionIds: [] } })),
    });
    const dialog = page.getByRole("dialog", { name: "Import backup" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveClass(/ui-popover/);
    const backdrop = await page.locator(".ui-backdrop").last().evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundImage: style.backgroundImage,
        backdropFilter: style.backdropFilter,
      };
    });
    expect(backdrop.backgroundImage).toContain("linear-gradient");
    expect(backdrop.backdropFilter).toContain("blur(8px)");
    await page.screenshot({ path: testInfo.outputPath(`backup-${theme}.png`) });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
  }

  await importSection.locator('input[accept*="text/html"]').setInputFiles({
    name: "bookmarks.html",
    mimeType: "text/html",
    buffer: Buffer.from("<DL><p></DL>"),
  });
  const bookmarksDialog = page.getByRole("dialog", { name: "Import browser bookmarks" });
  await expect(bookmarksDialog).toBeVisible();
  await expect(bookmarksDialog.getByRole("radio")).toHaveCount(3);
  await bookmarksDialog.getByRole("button", { name: "Cancel", exact: true }).click();

  const imageFolder = testInfo.outputPath("image-folder");
  await mkdir(imageFolder, { recursive: true });
  await writeFile(`${imageFolder}/reference.png`, Buffer.from([137, 80, 78, 71]));
  await importSection.locator('input[webkitdirectory]').setInputFiles(imageFolder);
  const imageDialog = page.getByRole("dialog", { name: "Import image folder" });
  await expect(imageDialog).toBeVisible();
  await expect(imageDialog.getByLabel("Collection (optional)")).toBeVisible();
  await imageDialog.getByRole("button", { name: "Cancel", exact: true }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Help" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("settings-mobile.png"), fullPage: true });
  await storage.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("storage-mobile.png") });
});

test("validated review merges newer details and replacement requires confirmation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  const note = (id: string, content: string, updatedAt: number, deletedAt?: number) => ({
    id, type: "note", title: "", content, tagIds: [], collectionIds: [],
    createdAt: 1, updatedAt, ...(deletedAt === undefined ? {} : { deletedAt }),
  });
  const readItems = () => page.evaluate(async () => {
    const request = indexedDB.open("keepall");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<{ id: string; content: string; deletedAt?: number }[]>((resolve, reject) => {
      const tx = db.transaction("items", "readonly");
      const get = tx.objectStore("items").getAll();
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
      tx.oncomplete = () => db.close();
    });
  });
  await page.evaluate(async (items) => {
    const request = indexedDB.open("keepall");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("items", "readwrite");
      for (const item of items) tx.objectStore("items").put(item);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    });
  }, [note("same", "Old detail", 1), note("old", "Remove later", 1), note("trash", "In Trash", 1, 3)]);
  await page.goto("/settings");
  const input = page.getByRole("region", { name: "Backup" }).locator('input[accept*="application/json"]');
  const incoming = { format: "keepall", version: 7, exportedAt: 50,
    items: [note("same", "Newer detail", 10), note("new", "Fresh note", 2)],
    tags: [], collections: [], assets: [], preferences: { pinnedCollectionIds: [] } };
  const select = () => input.setInputFiles({ name: "review.keepall.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(incoming)) });
  await select();
  const review = page.getByRole("dialog", { name: "Import backup" });
  const contents = review.getByRole("table", { name: "Backup contents comparison" });
  await expect(contents.getByRole("rowheader", { name: "All items" }).locator("..")).toContainText("All items32 active22 active");
  await expect(contents.getByRole("rowheader", { name: "In Trash" }).locator("..")).toContainText("In Trash10");
  await expect(contents.getByRole("rowheader", { name: "Notes" }).locator("..")).toContainText("Notes32");
  await review.getByRole("button", { name: "Merge" }).click();
  await expect(page.locator('div[role="status"][aria-atomic="true"]')).toContainText("Merged:");
  expect((await readItems()).find((item) => item.id === "same")?.content).toBe("Newer detail");
  expect((await readItems()).some((item) => item.id === "new")).toBe(true);
  await select();
  await review.getByRole("button", { name: "Replace library" }).click();
  const confirm = page.getByRole("dialog", { name: "Replace library?" });
  await expect(confirm).toContainText("4 items (3 active, 1 in Trash)");
  await expect.poll(() => confirm.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  for (let press = 0; press < 6; press += 1) {
    await page.keyboard.press("Tab");
    await expect.poll(() => confirm.evaluate((dialog) => dialog.contains(document.activeElement)),
      { message: `Tab ${press + 1} stays inside confirmation` }).toBe(true);
  }
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect.poll(() => review.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  for (let press = 0; press < 3; press += 1) {
    await page.keyboard.press("Tab");
    await expect.poll(() => review.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  }
  expect((await readItems()).length).toBe(4);
  await review.getByRole("button", { name: "Replace library" }).click();
  await confirm.getByRole("button", { name: "Confirm replacement" }).click();
  await expect(page.locator('div[role="status"][aria-atomic="true"]')).toContainText("Library replaced from backup");
  await page.reload();
  expect((await readItems()).map((item) => item.id).sort()).toEqual(["new", "same"]);
  await input.setInputFiles({ name: "broken.json", mimeType: "application/json", buffer: Buffer.from("{}") });
  await expect(page.getByRole("region", { name: "Backup" }).getByRole("alert")).toContainText("Backup format");
  expect((await readItems()).length).toBe(2);
});
