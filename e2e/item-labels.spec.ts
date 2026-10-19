import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Start your library", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("items", "readwrite");
      const article = "Component Playground\n\n" + "Long article body about components. ".repeat(200);
      const base = { type: "note", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 };
      transaction.objectStore("items").put({ ...base, id: "article", title: article, content: article });
      transaction.objectStore("items").put({ ...base, id: "unbroken", title: "", content: "x".repeat(1000) });
      transaction.objectStore("items").put({ ...base, id: "realistic", title: "", content: "there is a problem with standalone notes, it shows them truncated like a title and there is no way to see the full note\n\nSecond paragraph." });
      transaction.objectStore("items").put({ ...base, id: "trashed", title: article, content: article, deletedAt: 2 });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  });
  await page.reload();
});

test("library menus and item pages use the same short labels", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const article = page.locator('[data-item-id="article"]');
  for (const layout of ["Grid", "List"]) {
    await page.getByRole("button", { name: `${layout} view`, exact: true }).click();
    for (const entry of ["menu", "context"]) {
      if (entry === "context") await article.click({ button: "right" });
      else {
        await article.hover();
        await article.getByRole("button", { name: "Actions for Component Playground", exact: true }).click();
      }
      await page.getByRole("menuitem", { name: "Organize", exact: true }).click();
      const organizer = page.getByRole("dialog", { name: "Organize Component Playground", exact: true });
      await expect(organizer).toBeVisible();
      await expect(organizer).not.toContainText("Long article body");
      await organizer.getByRole("button", { name: "Close drawer" }).click();
      await expect(organizer).toBeHidden();
    }
    await article.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Move to Trash", exact: true }).click();
    // Library rows move immediately and offer Undo; only the full item page keeps a confirmation dialog.
    const undo = page.getByRole("button", { name: /^Undo moving/ });
    await expect(undo).toBeVisible();
    await undo.click();
    await expect(article).toBeVisible();
  }
  await page.goto("/items/article?from=%2F");
  await page.getByRole("button", { name: "Organize", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Organize Component Playground");
  await page.getByRole("button", { name: "Close drawer" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: "Move note to Trash" }).click();
  await expect(page.getByRole("dialog")).not.toContainText("Long article body");
  await page.screenshot({ path: testInfo.outputPath("short-trash-label.png") });
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.goto("/?trash=1");
  await page.locator('[data-item-id="trashed"]').getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("dialog")).toContainText("Delete “Component Playground”");
  await expect(page.getByRole("dialog")).not.toContainText("Long article body");
  expect(errors).toEqual([]);
});

test("unbroken labels keep dialogs and their actions inside a narrow viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/items/unbroken?from=%2F");
  await page.getByRole("button", { name: "Move note to Trash" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("x".repeat(63) + "…");
  await expect(dialog.getByRole("button", { name: "Move to Trash", exact: true })).toBeInViewport();
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("short-label-mobile.png") });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Organize", exact: true }).click();
  const organizer = page.getByRole("dialog");
  await expect(organizer).toHaveAccessibleName("Organize " + "x".repeat(63) + "…");
  await expect(organizer.getByRole("textbox", { name: "Move to collection" })).toBeInViewport();
  await organizer.getByRole("textbox", { name: "Add tag" }).scrollIntoViewIfNeeded();
  await expect(organizer.getByRole("textbox", { name: "Add tag" })).toBeInViewport();
  expect(await organizer.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test("an untitled note shows its complete text once on its card and page", async ({ page }, testInfo) => {
  const opening = "there is a problem with standalone notes, it shows them truncated like a title and there is no way to see the full note";
  await page.goto("/");
  const card = page.locator('[data-item-id="realistic"]');
  await expect(card.locator(".library-text-preview")).toContainText(opening);
  await expect(card.locator(".library-text-preview")).toContainText("Second paragraph.");
  await expect(card.getByRole("heading")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("untitled-note-card.png") });
  await card.getByRole("link", { name: /^Open / }).click();
  await expect(page).toHaveURL(/\/items\/realistic\?from=/);
  await expect(page.getByRole("heading", { level: 1, name: "Note", exact: true })).toBeVisible();
  await expect(page.locator("article")).toContainText(`${opening} Second paragraph.`);
  await page.screenshot({ path: testInfo.outputPath("untitled-note-page.png") });
  // A single-line note is fully readable too, not reduced to a shortened title.
  await page.goto("/items/unbroken?from=%2F");
  await expect(page.getByRole("heading", { level: 1, name: "Note", exact: true })).toBeVisible();
  await expect(page.locator("article")).toHaveText("x".repeat(1000));
});
