import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("persisted collapsed sections hydrate without replacing the sidebar", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.setItem("keepall-shell-collections-open", "closed");
    window.localStorage.setItem("keepall-shell-tags-open", "closed");
  });

  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (/Hydration failed|Minified React error #418|server rendered HTML/i.test(message.text())) {
      hydrationErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    if (/Hydration failed|Minified React error #418|server rendered HTML/i.test(error.message)) {
      hydrationErrors.push(error.message);
    }
  });

  await page.reload();

  const sidebar = page.getByRole("complementary", { name: "Sidebar" });
  await expect(
    sidebar.getByRole("button", { name: "Collections", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(
    sidebar.getByRole("button", { name: "Tags", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(hydrationErrors).toEqual([]);
});

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
  await expect(collectionRow).toHaveCSS("background-color", "rgb(230, 230, 227)");
  await expect(collectionRow).toHaveCSS("transition-duration", "0s");
  await expect(collectionActions).toHaveCSS("transition-duration", "0s");
  await collectionActions.hover();
  await expect(collectionRow).toHaveCSS("background-color", "rgb(230, 230, 227)");
  await tag.hover();
  await expect(tag.locator("..")).toHaveCSS("background-color", "rgb(230, 230, 227)");
  await expect(tag).toHaveCSS(
    "transition-property",
    /^(transform|transform, translate, scale, rotate)$/,
  );

  await sidebar.getByRole("button", { name: "Typography actions" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const tagDialog = page.getByRole("dialog", { name: "Delete tag?" });
  await expect(tagDialog).toContainText("removed from every item");
  await tagDialog.getByRole("button", { name: "Cancel" }).click();

  await collectionActions.click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const collectionDialog = page.getByRole("dialog", { name: "Delete collection?" });
  await expect(collectionDialog).toContainText("items stay in your library");
  await collectionDialog.getByRole("button", { name: "Cancel" }).click();
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
  const markers = sidebar.locator(".bg-collection-marker");
  await expect(markers).toHaveCount(36);
  const colors = await markers.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor));
  expect(new Set(colors).size).toBe(36);
  const folderSearch = sidebar.getByRole("textbox", { name: "Search collections" });
  await folderSearch.fill("Collection 01");
  await expect(markers).toHaveCount(1);
  await expect(markers).toHaveCSS("background-color", colors[0]);
  await folderSearch.fill("");
  await page.reload();
  await expect(markers).toHaveCount(36);
  expect(await markers.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor))).toEqual(colors);
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

  const scrollTopBeforeToggle = await collectionsScroll.evaluate(element => element.scrollTop);
  const sectionIconsBeforeToggle = await sidebar.locator("[data-sidebar-anchor] [data-sidebar-icon] svg").evaluateAll(
    icons => icons.map(icon => icon.getBoundingClientRect().y),
  );
  await page.getByRole("button", { name: "Collapse", exact: true }).click();
  await expect(sidebar.getByRole("textbox", { name: "Search collections" })).toHaveCount(0);
  await page.getByRole("button", { name: "Expand", exact: true }).click();
  expect(await collectionsScroll.evaluate(element => element.scrollTop)).toBe(scrollTopBeforeToggle);
  expect(await sidebar.locator("[data-sidebar-anchor] [data-sidebar-icon] svg").evaluateAll(
    icons => icons.map(icon => icon.getBoundingClientRect().y),
  )).toEqual(sectionIconsBeforeToggle);

  // A popup must escape the masked scroll area, not merely have a higher z-index.
  for (const colorScheme of ["light", "dark"] as const) {
    if (await page.locator("html").getAttribute("data-theme") !== colorScheme) {
      await page.getByRole("button", { name: "Theme", exact: true }).click();
    }
    await expect(page.locator("html")).toHaveAttribute("data-theme", colorScheme);
    const actions = sidebar.getByRole("button", { name: "Collection 36 actions" });
    await actions.click();
    const menu = page.getByRole("menu", { name: "Collection 36 actions" });
    await expect(menu).toBeVisible();
    expect(await menu.evaluate(element => element.closest(".scroll-fade") === null)).toBe(true);
    const remove = menu.getByRole("menuitem", { name: "Delete" });
    await expect.poll(() => remove.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    })).toBe(true);
    const menuBounds = (await menu.boundingBox())!;
    expect(menuBounds.y).toBeGreaterThanOrEqual(8);
    expect(menuBounds.y + menuBounds.height).toBeLessThanOrEqual(752);
    await page.screenshot({ path: `/tmp/keepall-sidebar-menu-${colorScheme}.png` });
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
    await expect(actions).toBeFocused();
  }

  // Place an interior row at either faded edge, then select it without scrolling
  // the other section or the document.
  for (const [scroll, name] of [[collectionsScroll, "Collection 20"], [tagsScroll, "Tag Tag 20"]] as const) {
    const row = sidebar.getByRole("button", { name, exact: true });
    for (const edge of ["bottom", "top"] as const) {
      await sidebar.getByRole("button", { name: "All items", exact: true }).click();
      await row.evaluate((element, edge) => {
        const container = element.closest(".library-sidebar-section-scroll")!;
        const rect = element.getBoundingClientRect();
        const bounds = container.getBoundingClientRect();
        container.scrollTop += edge === "bottom" ? rect.bottom - bounds.bottom : rect.top - bounds.top;
      }, edge);
      await row.click();
      await expect(row).toHaveAttribute("aria-current", "page");
      await expect.poll(() => row.evaluate(element => {
        const container = element.closest(".library-sidebar-section-scroll")!;
        const rect = element.getBoundingClientRect();
        const bounds = container.getBoundingClientRect();
        const margin = Math.min(container.clientHeight * 0.12, 40);
        return Math.min(rect.top - bounds.top - margin, bounds.bottom - rect.bottom - margin);
      }), { message: `${name} must clear the ${edge} fade` }).toBeGreaterThanOrEqual(0);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      expect(await scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    }
  }

  const topActions = sidebar.getByRole("button", { name: "Collection 20 actions" });
  await topActions.evaluate(element => {
    const container = element.closest(".library-sidebar-section-scroll")!;
    container.scrollTop += element.getBoundingClientRect().top - container.getBoundingClientRect().top;
  });
  await topActions.click();
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  const rename = sidebar.getByRole("textbox", { name: "Rename collection" });
  await expect(rename).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(rename).not.toBeVisible();

  await sidebar.getByRole("button", { name: "Collections", exact: true }).click();
  await expect(sectionScrolls).toHaveCount(1);
  await expect.poll(() => sectionScrolls.first().evaluate(element => element.clientHeight)).toBeGreaterThan(tagHeight);
  await expect(backup).toBeVisible();
});

test("pinned collections persist, reorder, and lead compact capture", async ({ page }) => {
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
        const tx = db.transaction(["collections", "preferences"], "readwrite");
        for (const [id, name, createdAt] of [
          ["alpha", "Alpha", 1],
          ["beta", "Beta", 2],
          ["gamma", "Gamma", 3],
        ] as const) {
          tx.objectStore("collections").put({
            id,
            name,
            createdAt,
            pinnedItemIds: [],
          });
        }
        tx.objectStore("preferences").put({
          id: "library",
          pinnedCollectionIds: ["beta", "alpha"],
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
  const collectionNames = () =>
    sidebar
      .locator(".library-sidebar-section-scroll")
      .first()
      .locator('button[aria-label]:not([aria-label$=" actions"])')
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute("aria-label")),
      );

  await expect.poll(collectionNames).toEqual([
    "Beta",
    "Alpha",
    "Gamma",
  ]);

  const alphaActions = sidebar.getByRole("button", { name: "Alpha actions" });
  await alphaActions.focus();
  await alphaActions.press("Enter");
  await page.getByRole("menuitem", { name: "Move up" }).press("Enter");
  await expect.poll(collectionNames).toEqual([
    "Alpha",
    "Beta",
    "Gamma",
  ]);

  await sidebar
    .getByRole("button", { name: "Beta" })
    .locator("..")
    .dragTo(sidebar.getByRole("button", { name: "Alpha" }).locator(".."));
  await expect.poll(collectionNames).toEqual([
    "Beta",
    "Alpha",
    "Gamma",
  ]);

  await page.reload();
  await expect.poll(collectionNames).toEqual([
    "Beta",
    "Alpha",
    "Gamma",
  ]);

  await page.keyboard.press("Alt+k");
  const captureCollections = page
    .getByRole("dialog", { name: "Save to Keepall" })
    .getByRole("list", { name: "Collections" });
  await expect(captureCollections.getByRole("button")).toHaveText([
    "Unsorted",
    "Beta",
    "Alpha",
    "Gamma",
  ]);
});
