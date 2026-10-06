import { expect, test, type Locator } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  // Seed only this test's disposable browser database.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction(["items", "collections", "tags"], "readwrite");
    for (let index = 0; index < 30; index++) {
      const suffix = String(index).padStart(2, "0");
      tx.objectStore("collections").put({ id: `c${index}`, name: `Collection ${suffix}`, createdAt: 1, pinnedItemIds: [] });
      tx.objectStore("tags").put({ id: `t${index}`, name: `Tag ${suffix}`, createdAt: 1 });
    }
    tx.objectStore("items").put({ id: "note", type: "note", title: "Menu reference", content: "A saved reference.", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
});

async function expectSameBounds(locator: Locator, before: NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>) {
  await expect(async () => {
    const after = (await locator.boundingBox())!;
    for (const key of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(after[key] - before[key]), key).toBeLessThanOrEqual(1);
    }
  }).toPass({ timeout: 3000 });
}

test("full item action menus use the available viewport without unnecessary scrolling", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 917 });
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result); });
    const tx = db.transaction("items", "readwrite");
    tx.objectStore("items").put({ id: "note", type: "link", title: "Menu reference", url: "https://example.test/reference", previewStatus: "ready", previewTitle: "Saved preview", previewRetry: "none", tagIds: [], collectionIds: ["c0"], createdAt: 1, updatedAt: 1 });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  });
  await page.goto("/?collection=c0");
  await expect(page.getByRole("heading", { name: "Collection 00", exact: true })).toBeVisible();
  const card = page.locator('[data-item-id="note"]');
  await card.click({ button: "right", position: { x: 30, y: 35 } });
  const popup = page.getByRole("menu", { name: "Actions for Menu reference", exact: true });
  await expect(popup.getByRole("menuitem", { name: "Refresh preview", exact: true })).toBeVisible();
  await expect(popup.getByRole("menuitem", { name: "Pin", exact: true })).toBeVisible();
  await expect(popup.getByRole("menuitem", { name: "Move to Trash", exact: true })).toBeVisible();
  expect(await popup.evaluate(node => {
    const scroll = node.querySelector(".ui-scrollbar") ?? node;
    return scroll.scrollHeight - scroll.clientHeight;
  })).toBeLessThanOrEqual(1);
  await expect(popup.getByRole("menuitem", { name: "Move to Trash", exact: true })).toBeInViewport({ ratio: 1 });
  await expect(popup.locator(".ui-scrollbar")).toHaveCSS("scrollbar-gutter", "auto");
  expect(await popup.getByRole("menuitem", { name: "Refresh preview", exact: true }).evaluate(node => {
    const row = node.getBoundingClientRect();
    const content = node.parentElement!.getBoundingClientRect();
    return Math.abs(row.width - content.width);
  })).toBeLessThanOrEqual(1);
  await popup.screenshot({ path: testInfo.outputPath("item-actions-desktop.png") });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 900, height: 360 });
  await card.click({ button: "right", position: { x: 30, y: 35 } });
  const bounds = (await popup.boundingBox())!;
  expect(bounds.y).toBeGreaterThanOrEqual(8);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(352);
  const scroll = popup.locator(".ui-scrollbar");
  await expect(scroll).toHaveCount(1);
  expect(await scroll.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
  expect(await scroll.evaluate(node => {
    const parent = node.parentElement!.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    return box.left > parent.left && box.right < parent.right && box.top > parent.top && box.bottom < parent.bottom;
  })).toBe(true);
  await page.keyboard.press("End");
  await expect(popup.getByRole("menuitem", { name: "Move to Trash", exact: true })).toBeFocused();
  await expect(popup.getByRole("menuitem", { name: "Move to Trash", exact: true })).toBeInViewport({ ratio: 1 });
  await popup.screenshot({ path: testInfo.outputPath("item-actions-short-viewport.png") });
});

for (const kind of ["Tags", "Collections"] as const) {
  for (const entry of ["button", "context"] as const) {
    test(`${kind} ${entry} submenu stays anchored while filtering and scrolling`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 1440, height: 1200 });
      const card = page.locator('[data-item-id="note"]');
      if (entry === "button") {
        await card.hover();
        await card.getByRole("button", { name: "Actions for Menu reference", exact: true }).click();
      } else {
        await card.click({ button: "right", position: { x: 30, y: 35 } });
      }
      const trigger = page.getByRole("menuitem", { name: kind, exact: true });
      await trigger.hover();
      const popup = page.getByRole("menu", { name: kind, exact: true });
      const search = popup.getByRole("textbox");
      await expect(search).toBeFocused();
      const before = (await popup.boundingBox())!;
      const inputBefore = (await search.boundingBox())!;
      expect(before.height).toBeLessThanOrEqual(360);
      expect(Math.abs(before.y - (await trigger.boundingBox())!.y)).toBeLessThanOrEqual(8);
      const results = popup.locator(".ui-scrollbar");
      await expect(results).toHaveCSS("scrollbar-gutter", "stable");
      expect(await results.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
      const prefix = kind === "Tags" ? "Tag" : "Collection";
      for (const query of [`${prefix} 29`, "A new destination", ""]) {
        await search.fill(query);
        await expectSameBounds(popup, before);
        await expectSameBounds(search, inputBefore);
      }
      await search.press("ArrowUp");
      const last = popup.getByRole(kind === "Tags" ? "menuitemcheckbox" : "menuitemradio", { name: `${prefix} 29`, exact: true });
      await expect(last).toBeFocused();
      await expect(last).toBeInViewport();
      expect(await results.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      await expectSameBounds(popup, before);
      await page.screenshot({ path: testInfo.outputPath("anchored-menu.png") });
    });
  }
}

for (const viewport of [{ width: 320, height: 640 }, { width: 900, height: 480 }]) {
  test(`submenus stay stable inside ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/?view=list");
    const closeNavigation = page.getByRole("button", { name: "Close navigation", exact: true });
    if (await closeNavigation.isVisible()) await closeNavigation.click();
    const card = page.locator('[data-item-id="note"]');
    await card.click({ button: "right", position: { x: 30, y: 35 } });
    await page.getByRole("menuitem", { name: "Collections", exact: true }).click();
    const popup = page.getByRole("menu", { name: "Collections", exact: true });
    await expect(popup.getByRole("textbox")).toBeFocused();
    const before = (await popup.boundingBox())!;
    expect(before.x).toBeGreaterThanOrEqual(0);
    expect(before.y).toBeGreaterThanOrEqual(0);
    expect(before.x + before.width).toBeLessThanOrEqual(viewport.width);
    expect(before.y + before.height).toBeLessThanOrEqual(viewport.height);
    await popup.getByRole("textbox").fill("Collection 29");
    await expectSameBounds(popup, before);
  });
}

for (const kind of ["collection", "tag"] as const) {
  test(`capture ${kind} browser keeps the search in place`, async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 560 });
    await page.getByRole("button", { name: "Save item", exact: true }).click();
    const capture = page.getByRole("dialog", { name: "Save to Keepall" });
    await capture.getByRole("button", { name: `Browse all ${kind}s` }).click();
    const chooser = page.getByRole("dialog", { name: `Choose a ${kind}` });
    const search = chooser.getByRole("searchbox");
    const before = (await chooser.boundingBox())!;
    const inputBefore = (await search.boundingBox())!;
    for (const query of [kind === "tag" ? "Tag 29" : "Collection 29", "No matching name", ""]) {
      await search.fill(query);
      await expectSameBounds(chooser, before);
      await expectSameBounds(search, inputBefore);
    }
  });
}

test("organizer choices filter inline and the full picker stays stable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 560 });
  await page.goto("/items/note");
  await page.getByRole("button", { name: "Organize", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Organize Menu reference" });
  const field = drawer.getByRole("textbox", { name: "Add tag", exact: true });
  await field.fill("Tag");
  const before = (await field.boundingBox())!;
  await field.fill("Tag 29");
  await expectSameBounds(field, before);
  await expect(drawer.getByRole("button", { name: "Tag 29", exact: true })).toBeInViewport();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await drawer.getByRole("button", { name: "Browse all tags" }).click();
  const picker = page.getByRole("dialog", { name: "Choose a tag" });
  const bounds = (await picker.boundingBox())!;
  await picker.getByRole("searchbox", { name: "Search tags" }).fill("Tag 29");
  await expectSameBounds(picker, bounds);
  await picker.getByRole("button", { name: "Tag 29", exact: true }).click();
  await expect(drawer.getByRole("button", { name: "Remove tag Tag 29" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("compact-organizer.png") });
});
