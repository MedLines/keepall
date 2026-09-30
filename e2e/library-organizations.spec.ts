import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
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
        const tx = db.transaction(["collections", "tags", "items"], "readwrite");
        for (const [id, name] of [["design", "Design"], ["reading", "Reading"], ["keep", "Keep"]]) {
          tx.objectStore("collections").put({ id, name, createdAt: 1, pinnedItemIds: [] });
          tx.objectStore("tags").put({ id: `tag-${id}`, name: name.toLowerCase(), createdAt: 1 });
          tx.objectStore("items").put({ id: `note-${id}`, type: "note", title: `${name} note`, content: `Saved ${name} content`, collectionIds: [id], tagIds: [`tag-${id}`], createdAt: 1, updatedAt: 1 });
        }
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
  await page.reload();
});

test("tags show item previews in cards and open their matching items", async ({ page }, testInfo) => {
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 180; canvas.height = 140;
    const ctx = canvas.getContext("2d")!;
    const photos: Blob[] = [];
    for (const color of ["#93b2a6", "#b7a68d"]) {
      ctx.fillStyle = color; ctx.fillRect(0, 0, 180, 140);
      ctx.fillStyle = "#edf0e5"; ctx.fillRect(30, 25, 75, 90);
      ctx.fillStyle = "#496660"; ctx.fillRect(42, 38, 52, 20);
      photos.push(await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), "image/png")));
    }
    const db = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["items", "tags", "thumbnails"], "readwrite");
        tx.objectStore("tags").put({ id: "tag-empty", name: "someday", createdAt: 0 });
        photos.forEach((blob, index) => {
          const assetId = `study-${index}`;
          tx.objectStore("thumbnails").put({ assetId, blob });
          tx.objectStore("items").put({ id: assetId, type: "image", title: `Study ${index + 1}`, caption: "", sourceUrl: "", assetIds: [assetId], collectionIds: ["design"], tagIds: ["tag-design"], createdAt: index + 2, updatedAt: index + 2 });
        });
        tx.objectStore("items").put({ id: "note-keep", type: "image", title: "Leaf study", caption: "", sourceUrl: "", assetIds: ["study-0"], collectionIds: ["keep"], tagIds: ["tag-keep"], createdAt: 1, updatedAt: 1 });
        tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
  await page.reload();
  const libraryShape = await page.locator('[data-item-id="study-0"] .library-card').evaluate(element => {
    const outer = getComputedStyle(element);
    const media = getComputedStyle(element.querySelector('.library-card-media')!);
    return { radius: outer.borderRadius, corner: outer.getPropertyValue('corner-shape'), inset: media.borderTopWidth, mediaRadius: media.borderRadius, mediaCorner: media.getPropertyValue('corner-shape') };
  });
  await page.getByRole("button", { name: "All tags", exact: true }).click();
  await expect(page).toHaveURL(/tags=1/);
  await expect(page.getByRole("button", { name: "All tags", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "All items", exact: true })).not.toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("group", { name: "Library layout", exact: true })).toBeVisible();
  const tags = page.getByRole("list", { name: "Library tags", exact: true });
  await expect(tags.locator(".library-tag-card")).toHaveCount(4);
  await expect(tags.locator(".library-tag-stage")).toHaveCount(4);
  const design = tags.getByRole("link", { name: "Open design, 3 items", exact: true });
  expect(await design.evaluate(element => {
    const outer = getComputedStyle(element);
    const media = getComputedStyle(element.querySelector('.library-card-media')!);
    return { radius: outer.borderRadius, corner: outer.getPropertyValue('corner-shape'), inset: media.borderTopWidth, mediaRadius: media.borderRadius, mediaCorner: media.getPropertyValue('corner-shape') };
  })).toEqual(libraryShape);
  await expect(design.locator(".library-tag-preview")).toHaveCount(3);
  await expect(design.locator("img")).toHaveCount(2);
  await expect(tags.getByRole("link", { name: "Open someday, 0 items", exact: true }).locator(".library-tag-empty")).toBeVisible();
  await expect(tags.locator(".collection-folder-stage")).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("READ");
  await expect(tags.getByRole("link", { name: /^Open / })).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("");
  await expect(tags.getByRole("link", { name: /^Open / })).toHaveCount(4);
  await page.getByRole("searchbox", { name: "Search", exact: true }).blur();
  await page.mouse.move(0, 0);
  await page.screenshot({ path: testInfo.outputPath("tags-view.png") });
  if (await page.locator("html").getAttribute("data-theme") !== "dark") await page.getByRole("button", { name: "Theme", exact: true }).click();
  await design.hover();
  await page.screenshot({ path: testInfo.outputPath("tags-dark.png") });
  await tags.getByRole("link", { name: "Open reading, 1 item", exact: true }).click();
  await expect(page).toHaveURL(/tag=tag-reading/);
  await expect(page.getByRole("main")).toContainText("Saved Reading content");
  await expect(page.getByRole("main")).not.toContainText("Saved Design content");
  await page.getByRole("button", { name: "All tags", exact: true }).click();
  await expect(page).toHaveURL(/tags=1/);
  await page.reload();
  await expect(tags).toBeVisible();
  await page.setViewportSize({ width: 320, height: 825 });
  await page.getByRole("button", { name: "Close navigation", exact: true }).click();
  await expect(page.getByRole("group", { name: "Library layout", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("tags-mobile.png") });
});

test("Grid and List remain available and change layout without leaving either overview", async ({ page }) => {
  for (const kind of ["collections", "tags"] as const) {
    await page.getByRole("button", { name: `All ${kind}`, exact: true }).click();
    const entries = page.getByRole("list", { name: `Library ${kind}`, exact: true });
    await page.getByRole("button", { name: "List view", exact: true }).click();
    await expect(entries).toHaveClass(/organization-list/);
    await expect(page).toHaveURL(new RegExp(`${kind}=1`));
    await expect(page.getByRole("button", { name: "List view", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Grid view", exact: true }).click();
    await expect(entries).not.toHaveClass(/organization-list/);
    await expect(page.getByRole("button", { name: "Grid view", exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  await page.getByRole("button", { name: "All items", exact: true }).click();
  await page.getByRole("button", { name: "List view", exact: true }).click();
  await expect(page.getByRole("button", { name: "List view", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("main")).toContainText("Saved Design content");
});

test("folder context menu opens the actual collection in a new tab", async ({ page, context }) => {
  await page.getByRole("button", { name: "All collections", exact: true }).click();
  const folders = page.getByRole("list", { name: "Library collections", exact: true });
  const design = folders.getByRole("link", { name: "Open Design, 1 item", exact: true });
  await design.click({ button: "right" });
  const newTab = context.waitForEvent("page");
  await page.getByRole("menuitem", { name: "Open in new tab", exact: true }).click();
  const tab = await newTab;
  await expect(tab).toHaveURL(/collection=design/);
  await expect(tab.locator("#library-heading")).toHaveText("Design");
  await expect(tab.getByRole("main")).toContainText("Saved Design content");
  await tab.close();
  await expect(folders).toBeVisible();
});

test("bulk folder deletion preserves its items and supports cancel", async ({ page }) => {
  await page.getByRole("button", { name: "All collections", exact: true }).click();
  const folders = page.getByRole("list", { name: "Library collections", exact: true });
  await folders.getByRole("checkbox", { name: "Select Design", exact: true }).locator("..").hover();
  await folders.getByRole("checkbox", { name: "Select Design", exact: true }).locator("..").click();
  await folders.getByRole("checkbox", { name: "Select Reading", exact: true }).locator("..").hover();
  await folders.getByRole("checkbox", { name: "Select Reading", exact: true }).locator("..").click();
  await page.getByRole("button", { name: "Delete folders", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Delete 2 folders?", exact: true });
  await expect(confirm).toContainText("stay in your library and become Unsorted");
  await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(folders.getByRole("link", { name: /^Open / })).toHaveCount(3);
  await page.getByRole("button", { name: "Delete folders", exact: true }).click();
  await confirm.getByRole("button", { name: "Delete folders", exact: true }).click();
  await expect(folders.getByRole("link", { name: /^Open / })).toHaveCount(1);
  await page.reload();
  await expect(folders.getByRole("link", { name: "Open Keep, 1 item", exact: true })).toBeVisible();
  await page.getByRole("complementary", { name: "Sidebar" }).getByRole("button", { name: "Unsorted", exact: true }).click();
  await expect(page.getByRole("main")).toContainText("Saved Design content");
  await expect(page.getByRole("main")).toContainText("Saved Reading content");
});

test("bulk tag deletion keeps the items and their folder memberships", async ({ page }) => {
  await page.getByRole("button", { name: "All tags", exact: true }).click();
  const tags = page.getByRole("list", { name: "Library tags", exact: true });
  await tags.getByRole("checkbox", { name: "Select design", exact: true }).locator("..").hover();
  await tags.getByRole("checkbox", { name: "Select design", exact: true }).locator("..").click();
  await tags.getByRole("checkbox", { name: "Select reading", exact: true }).locator("..").hover();
  await tags.getByRole("checkbox", { name: "Select reading", exact: true }).locator("..").click();
  await page.getByRole("button", { name: "Delete tags", exact: true }).click();
  await page.getByRole("dialog", { name: "Delete 2 tags?", exact: true }).getByRole("button", { name: "Delete tags", exact: true }).click();
  await expect(tags.getByRole("link", { name: /^Open / })).toHaveCount(1);
  await page.getByRole("complementary", { name: "Sidebar" }).getByRole("button", { name: "Design", exact: true }).click();
  await expect(page.getByRole("main")).toContainText("Saved Design content");
  await expect(page).toHaveURL(/collection=design/);
  await page.reload();
  await expect(page.getByRole("main")).toContainText("Saved Design content");
});

for (const opener of ["button", "shortcut"] as const) {
  test(`${opener} capture defaults to the current folder and saves there`, async ({ page }) => {
    const sidebar = page.getByRole("complementary", { name: "Sidebar" });
    await sidebar.getByRole("button", { name: "Design", exact: true }).click();
    await expect(page.locator("#library-heading")).toHaveText("Design");
    if (opener === "button") await page.getByRole("button", { name: "Save item", exact: true }).click();
    else await page.keyboard.press("Alt+k");
    const capture = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
    await expect(capture.getByRole("button", { name: "Design", exact: true })).toHaveAttribute("aria-pressed", "true");
    await capture.getByRole("textbox", { name: "Link, note, or image", exact: true }).fill(`Filed with ${opener}`);
    await capture.getByRole("button", { name: "Save", exact: true }).click();
    await expect(capture).toBeHidden();
    await expect(page.getByRole("main")).toContainText(`Filed with ${opener}`);
    await sidebar.getByRole("button", { name: "All items", exact: true }).click();
    await page.keyboard.press("Alt+k");
    await expect(capture.getByRole("button", { name: "Unsorted", exact: true })).toHaveAttribute("aria-pressed", "true");
  });
}


test("organization selection matches library cards and uses their top-bar actions", async ({ page }, testInfo) => {
  const libraryCard = page.locator('[data-item-id="note-design"] .library-card');
  await libraryCard.hover();
  await libraryCard.locator('[data-selection-indicator]').click();
  await expect(libraryCard.getByRole('checkbox')).toBeChecked();
  const libraryColors = await libraryCard.evaluate(element => {
    const card = getComputedStyle(element);
    const checkbox = getComputedStyle(element.querySelector('label')!);
    return { background: card.backgroundColor, checkbox: checkbox.backgroundColor, color: checkbox.color };
  });
  const toolbar = page.getByRole('region', { name: 'Bulk actions', exact: true });
  await expect(page.locator('.library-top-bar').getByRole('region', { name: 'Bulk actions' })).toBeVisible();
  await toolbar.getByRole('button', { name: 'Deselect all', exact: true }).click();

  for (const kind of ['collections', 'tags'] as const) {
    await page.getByRole('button', { name: `All ${kind}`, exact: true }).click();
    await expect(toolbar).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Select all/ })).toHaveCount(0);
    const list = page.getByRole('list', { name: `Library ${kind}`, exact: true });
    const first = list.locator('.organization-card').first();
    await first.hover();
    await first.locator('[data-selection-indicator]').click();
    await expect(first.getByRole('checkbox')).toBeChecked();
    await expect(toolbar).toContainText('1 selected');
    await expect(page.locator('.library-top-bar').getByRole('region', { name: 'Bulk actions' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('region', { name: 'Bulk actions' })).toHaveCount(0);
    expect(await first.evaluate(element => {
      const card = getComputedStyle(element.querySelector('.collection-folder')!);
      const checkbox = getComputedStyle(element.querySelector('label')!);
      return { background: card.backgroundColor, checkbox: checkbox.backgroundColor, color: checkbox.color };
    })).toEqual(libraryColors);
    await toolbar.getByRole('button', { name: 'Select all', exact: true }).click();
    await expect(list.locator('input:checked')).toHaveCount(3);
    await expect(toolbar).toContainText('3 selected');
    await expect(toolbar.getByRole('button', { name: 'Select all', exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`${kind}-selected.png`) });
    await toolbar.getByRole('button', { name: 'Deselect all', exact: true }).click();
    await expect(list.locator('input:checked')).toHaveCount(0);
    await expect(toolbar).toHaveCount(0);
    // Keyboard selection and Escape use the same native checkbox behavior.
    await first.getByRole('checkbox').focus();
    await page.keyboard.press('Space');
    await expect(first.getByRole('checkbox')).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(first.getByRole('checkbox')).not.toBeChecked();
    await expect(toolbar).toHaveCount(0);
  }
});

test("unenriched links show three distinct previews with useful titles and sources", async ({ page }, testInfo) => {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open('keepall'); request.onsuccess = () => resolve(request.result);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['tags', 'items'], 'readwrite');
        tx.objectStore('tags').put({ id: 'tag-review', name: 'needs-review', createdAt: 10 });
        for (let index = 0; index < 9; index++) {
          tx.objectStore('items').put({ id: `link-${index}`, type: 'link', title: index < 6 ? `Old link ${index}` : ['Reading notes', 'Interface details', 'Research collection'][index - 6], url: `https://${['example.org', 'design.example', 'research.example'][index % 3]}/saved/${index}`, previewStatus: 'failed', previewRetry: 'none', previewTitle: '', previewDescription: '', previewImageUrl: '', previewAssetId: index === 8 ? 'missing-thumbnail' : null, previewAttemptedAt: 1, tagIds: ['tag-review'], collectionIds: [], createdAt: index + 10, updatedAt: index + 10 });
        }
        tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
  await page.reload();
  await page.getByRole('button', { name: 'All tags', exact: true }).click();
  const card = page.getByRole('link', { name: 'Open needs-review, 9 items', exact: true });
  await expect(card.locator('.library-tag-link')).toHaveCount(3);
  await expect(card.locator('.library-tag-link-title')).toHaveText(['Research collection', 'Interface details', 'Reading notes']);
  await expect(card.locator('.library-tag-link-host')).toHaveText(['research.example', 'design.example', 'example.org']);
  await expect(card.locator('.library-tag-preview svg')).toHaveCount(0);
  await expect(card).not.toContainText('Old link');
  const tiles = await card.locator('.library-tag-preview').evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element); const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, radius: style.borderRadius, ring: style.boxShadow };
  }));
  expect(tiles[1].x - tiles[0].right).toBeGreaterThanOrEqual(6);
  expect(tiles[2].y - tiles[1].bottom).toBeGreaterThanOrEqual(6);
  expect(tiles.every(tile => tile.radius !== '0px' && tile.ring !== 'none')).toBe(true);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: testInfo.outputPath('tags-links-light.png') });
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('tags-links-dark.png') });
  await page.setViewportSize({ width: 320, height: 825 });
  await page.getByRole('button', { name: 'Close navigation', exact: true }).click();
  await expect(card).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
