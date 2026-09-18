import { expect, test, type Page } from "@playwright/test";

async function expectCardsNotToOverlap(page: Page) {
  await expect(async () => {
    const boxes = await page.locator(".library-card").evaluateAll(nodes => nodes.map(node => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    }));
    for (let i = 0; i < boxes.length; i++) {
      for (const other of boxes.slice(i + 1)) {
        const box = boxes[i];
        const overlap = box.x < other.x + other.width - 1 && other.x < box.x + box.width - 1
          && box.y < other.y + other.height - 1 && other.y < box.y + box.height - 1;
        expect(overlap).toBe(false);
      }
    }
    for (const box of boxes) {
      const next = boxes.filter(other => Math.abs(other.x - box.x) < 1 && other.y > box.y)
        .sort((a, b) => a.y - b.y)[0];
      if (next) expect(Math.abs(next.y - box.y - box.height - 20)).toBeLessThanOrEqual(1);
    }
  }).toPass({ timeout: 5000 });
}

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.route("https://www.google.com/s2/favicons**", route => route.abort());
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  // This database belongs to Playwright's disposable browser context.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 240;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#d9e7e2";
    context.fillRect(0, 0, 600, 240);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!)));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const base = { createdAt: 1, updatedAt: 1, collectionIds: ["c"], tagIds: ["t"] };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["items", "assets", "collections", "tags"], "readwrite");
      tx.objectStore("collections").put({ id: "c", name: "UI inspiration", createdAt: 1, pinnedItemIds: [] });
      tx.objectStore("tags").put({ id: "t", name: "minimal", createdAt: 1 });
      tx.objectStore("assets").put({ id: "asset", bytes, mimeType: "image/png", byteLength: bytes.length, contentHash: "fixture", createdAt: 1 });
      tx.objectStore("items").put({ ...base, id: "image", type: "image", title: "Customer support", assetIds: ["asset"], caption: "", sourceUrl: "", createdAt: 4 });
      tx.objectStore("items").put({ ...base, id: "note", type: "note", title: "Design notes", content: "Keep the card quiet.\n\nLet the image lead.", createdAt: 3 });
      const link = { ...base, type: "link", title: "Footer reference", url: "https://example.com/footer", previewTitle: "", previewDescription: "A spacious footer for a portfolio.", previewStatus: "ready", previewRetry: "none", previewAttemptedAt: 1, previewImageUrl: "", previewAssetId: "asset" };
      tx.objectStore("items").put({ ...link, id: "link", createdAt: 2 });
      tx.objectStore("items").put({ ...link, id: "fallback", title: "", url: "https://example.com/fallback", previewAssetId: null });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
});

test("item types live in the toolbar while library destinations stay in the sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const sidebar = page.getByRole("complementary", { name: "Sidebar" });
  for (const label of ["All items", "Unsorted"]) {
    await expect(sidebar.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  for (const label of ["Images", "Links", "Notes"]) {
    await expect(sidebar.getByRole("button", { name: label, exact: true })).toHaveCount(0);
  }

  const typeMenu = page.getByRole("button", { name: "Filter by type" });
  const layoutControls = page.getByRole("group", { name: "Library layout" });
  const sortMenu = page.getByRole("button", { name: "Sort library" });
  const scopeBounds = (await typeMenu.boundingBox())!;
  const layoutBounds = (await layoutControls.boundingBox())!;
  const sortBounds = (await sortMenu.boundingBox())!;
  expect(scopeBounds.x + scopeBounds.width).toBeLessThanOrEqual(layoutBounds.x);
  expect(layoutBounds.x + layoutBounds.width).toBeLessThanOrEqual(sortBounds.x);

  await typeMenu.click();
  const menu = page.getByRole("listbox", { name: "Filter by type" });
  const expectedCounts = new Map([
    ["All types", "4"],
    ["Images", "1"],
    ["Links", "2"],
    ["Notes", "1"],
  ]);
  for (const [label, count] of expectedCounts) {
    await expect(menu.getByRole("option", { name: new RegExp(label) })).toContainText(count);
  }

  await menu.getByRole("option", { name: /Images/ }).click();
  await expect(page).toHaveURL(/type=image/);
  await expect(page.getByRole("heading", { name: "Images", exact: true })).toBeVisible();
  await typeMenu.click();
  await page.getByRole("option", { name: /All types/ }).click();
  await expect(page).not.toHaveURL(/type=/);
  await expect(page.getByRole("heading", { name: "All items", exact: true })).toBeVisible();
});

test("sidebar section icons align and All items does not reuse the Grid icon", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const sidebar = page.getByRole("complementary", { name: "Sidebar" });
  const allItemsIcon = sidebar
    .getByRole("button", { name: "All items", exact: true })
    .locator("svg");
  const collectionsIcon = sidebar
    .getByRole("button", { name: "Collections", exact: true })
    .locator("svg")
    .first();
  const gridIcon = page
    .getByRole("button", { name: "Grid view", exact: true })
    .locator("svg");

  const allItemsBounds = (await allItemsIcon.boundingBox())!;
  const collectionsBounds = (await collectionsIcon.boundingBox())!;
  expect(Math.abs(allItemsBounds.x - collectionsBounds.x)).toBeLessThanOrEqual(1);
  expect(await allItemsIcon.innerHTML()).not.toBe(await gridIcon.innerHTML());
  await expect(
    sidebar.getByRole("button", { name: "New collection" }),
  ).toHaveCount(0);
});

for (const view of ["Grid", "List"] as const) {
  test(`${view}: collection context opens that collection`, async ({ page }) => {
    await page.getByRole("button", { name: `${view} view`, exact: true }).click();
    const item = page.locator(view === "Grid" ? ".library-card" : ".library-list-row").filter({ hasText: "Customer support" });
    const collection = item.getByRole("button", {
      name: view === "Grid" ? "UI inspiration" : "in UI inspiration",
      exact: true,
    });
    await collection.click();
    await expect(page).toHaveURL(/collection=c(?:&|$)/);
    await expect(page.getByRole("heading", { name: "UI inspiration", exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}

for (const view of ["Grid", "List"] as const) {
  for (const title of ["Customer support", "Footer reference"]) {
    test(`${view}: ${title} exposes tags that open the tag view`, async ({ page }) => {
      await page.getByRole("button", { name: `${view} view`, exact: true }).click();
      const item = page.locator(view === "Grid" ? ".library-card" : ".library-list-row").filter({ hasText: title });
      if (view === "Grid") {
        await item.hover();
        await item.getByRole("button", { name: "1 tag" }).click();
      }
      await expect(item.getByRole("button", { name: "minimal", exact: true })).toBeVisible();
      await item.getByRole("button", { name: "minimal", exact: true }).click();
      await expect(page).toHaveURL(/tag=t(?:&|$)/);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(item).toBeVisible();
    });
  }

  test(`${view}: extra image tags expand and navigate without opening the image`, async ({ page }) => {
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>(resolve => {
        const request = indexedDB.open("keepall");
        request.onsuccess = () => resolve(request.result);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["items", "tags"], "readwrite");
        tx.objectStore("tags").put({ id: "t2", name: "motion", createdAt: 2 });
        tx.objectStore("tags").put({ id: "t3", name: "typography", createdAt: 3 });
        const request = tx.objectStore("items").get("image");
        request.onsuccess = () => tx.objectStore("items").put({ ...request.result, tagIds: ["t", "t2", "t3"] });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    });
    await page.reload();
    await page.getByRole("button", { name: `${view} view`, exact: true }).click();
    const item = page.locator(view === "Grid" ? ".library-card" : ".library-list-row").filter({ hasText: "Customer support" });
    if (view === "Grid") await item.hover();
    const overflow = item.getByRole("button", { name: view === "Grid" ? "3 tags" : "Show 1 more tags" });
    await expect(item.getByRole("button", { name: "typography", exact: true })).toHaveCount(0);
    await overflow.click();
    const tag = item.getByRole("button", { name: "typography", exact: true });
    await tag.focus();
    await page.keyboard.press("Escape");
    await expect(overflow).toBeFocused();
    await overflow.click();
    await tag.click();
    await expect(page).toHaveURL(/tag=t3(?:&|$)/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(view === "Grid" ? ".library-card" : ".library-list-row")).toHaveCount(1);
  });
}

test("tagged images stay discoverable in All items and Unsorted in a large library", async ({ page }) => {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("items", "readwrite");
      const image = tx.objectStore("items").get("image");
      image.onsuccess = () => tx.objectStore("items").put({ ...image.result, collectionIds: [], createdAt: 10000 });
      for (let i = 0; i < 70; i++) tx.objectStore("items").put({ id: `unsorted-${i}`, type: "note", title: `Unsorted ${i}`, content: "A design reference.", createdAt: 100 + i, updatedAt: 1, collectionIds: [], tagIds: [] });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  for (const view of ["Grid", "List"]) {
    await page.getByRole("button", { name: `${view} view`, exact: true }).click();
    for (const scope of ["All items", "Unsorted", "All items"]) {
      await page.getByRole("button", { name: scope, exact: true }).click();
      const item = page.locator(view === "Grid" ? ".library-card" : ".library-list-row").filter({ hasText: "Customer support" });
      if (view === "Grid") {
        await item.hover();
        const trigger = item.getByRole("button", { name: "1 tag" });
        await expect(trigger).toBeVisible();
        if (await trigger.getAttribute("aria-expanded") === "false") await trigger.click();
      }
      await expect(item.getByRole("button", { name: "minimal", exact: true })).toBeVisible();
      await item.getByRole("button", { name: "minimal", exact: true }).click();
      await expect(page).toHaveURL(/tag=t(?:&|$)/);
      await expect(item.getByRole("button", { name: view === "Grid" ? "1 tag" : "minimal", exact: true })).toBeVisible();
    }
  }
});

test("long Library content fades only the edges with hidden items", async ({ page }) => {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("items", "readwrite");
      for (let index = 0; index < 70; index++) {
        tx.objectStore("items").put({
          id: `fade-${index}`,
          type: "note",
          title: `Fade check ${index}`,
          content: "A design reference.",
          createdAt: 100 + index,
          updatedAt: 1,
          collectionIds: [],
          tagIds: [],
        });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();

  const library = page.getByRole("main");
  await expect(library).toHaveClass(/scroll-fade/);

  const fadeVisible = async (edge: "t" | "b") =>
    library.evaluate(
      (element, property) => {
        const value = getComputedStyle(element).getPropertyValue(property).trim();
        return value !== "0px" && !value.includes("(0 *");
      },
      `--scroll-fade-${edge}`,
    );

  await expect.poll(() => fadeVisible("t")).toBe(false);
  await expect.poll(() => fadeVisible("b")).toBe(true);

  await library.evaluate((element) => {
    element.scrollTop = (element.scrollHeight - element.clientHeight) / 2;
  });
  await expect.poll(() => fadeVisible("t")).toBe(true);
  await expect.poll(() => fadeVisible("b")).toBe(true);

  await library.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => fadeVisible("t")).toBe(true);
  await expect.poll(() =>
    library.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      const value = getComputedStyle(element)
        .getPropertyValue("--scroll-fade-b")
        .trim();
      return value !== "0px" && !value.includes("(0 *");
    }),
  ).toBe(false);
});

test("list links show larger favicons while retaining preview images", async ({ page }) => {
  await page.route("https://www.google.com/s2/favicons**", route => route.fulfill({
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#2563eb"/></svg>',
  }));
  await page.reload();
  await page.getByRole("button", { name: "List view", exact: true }).click();
  const link = page.locator(".library-list-row").filter({ hasText: "Footer reference" });
  await expect(link.locator('img[src^="blob:"]')).toBeVisible();
  await expect(link.locator('img[src*="favicons"]')).toHaveCSS("width", "24px");
  const fallback = page.locator(".library-list-row").filter({ hasText: "example.com/fallback" });
  await expect(fallback.locator('img[src*="favicons"]').first()).toHaveCSS("width", "32px");
});

test("mixed cards preserve image proportions, readable notes and compact fallbacks", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const image = page.locator(".library-card").filter({ has: page.getByRole("heading", { name: "Customer support" }) });
  const picture = image.locator("img");
  await expect(picture).toBeVisible();
  await expect.poll(() => picture.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBe(600);
  const bounds = await picture.boundingBox();
  expect(bounds!.width / bounds!.height).toBeCloseTo(2.5, 1);
  const note = page.locator(".library-card").filter({ has: page.getByRole("heading", { name: "Design notes" }) });
  await expect(note.locator("img")).toHaveCount(0);
  await expect(note.getByRole("button", { name: "Read Design notes" })).toContainText("Let the image lead.");
  const link = page.locator(".library-card").filter({ has: page.getByRole("heading", { name: "Footer reference" }) });
  await expect(link.locator('img[src^="blob:"]')).toBeVisible();
  await expect(link.getByText("A spacious footer for a portfolio.")).toBeVisible();
  const fallback = page.locator(".library-card").filter({ has: page.getByRole("heading", { name: "example.com/fallback" }) });
  await expect(fallback.locator("img")).toHaveCount(0);
  await expect(fallback).toHaveCSS("border-radius", "20px");
  expect((await fallback.boundingBox())!.height).toBeLessThan(200);
  await page.getByRole("combobox", { name: "Theme" }).selectOption("dark");
  await expect(fallback).toHaveCSS("background-image", /linear-gradient/);
  await expect(fallback).toHaveCSS("box-shadow", /255, 255, 255/);
});

test("desktop card actions reveal on hover or focus and stay visible while open", async ({ page }) => {
  const card = page.locator(".library-card").first();
  const actions = card.locator("details");
  const trigger = actions.locator("summary");
  await page.mouse.move(0, 0);
  await expect(actions).toHaveCSS("opacity", "0");
  await card.hover();
  await expect(actions).toHaveCSS("opacity", "1");
  await trigger.click();
  await page.mouse.move(0, 0);
  await page.getByRole("button", { name: "All items", exact: true }).focus();
  await expect(actions).toHaveCSS("opacity", "1");
  await trigger.focus();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(actions).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "All items", exact: true }).focus();
  await expect(actions).toHaveCSS("opacity", "0");
  await trigger.focus();
  await expect(actions).toHaveCSS("opacity", "1");
});

test("organizer opens from the side without resizing the card", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const note = page.locator(".library-card").filter({ hasText: "Design notes" });
  const before = (await note.boundingBox())!;

  await note.hover();
  await note.locator("summary").click();
  await note.getByRole("button", { name: "Organize" }).click();

  const drawer = page.getByRole("dialog", { name: "Organize Design notes" });
  await expect(drawer).toBeVisible();
  await expect(note.locator("details")).not.toHaveAttribute("open", "");
  await expect.poll(async () => {
    const box = await drawer.boundingBox();
    return box ? Math.round(box.x + box.width) : null;
  }).toBe(1432);
  const drawerBox = (await drawer.boundingBox())!;
  expect(Math.abs(drawerBox.x + drawerBox.width - 1432)).toBeLessThanOrEqual(1);
  expect(drawerBox.width).toBeLessThanOrEqual(448);
  expect(drawerBox.height).toBe(884);
  expect(await note.boundingBox()).toEqual(before);
  await expect(drawer.getByLabel("Add tag")).toBeVisible();
  await expect(drawer.getByLabel("Move to collection")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(note.locator("summary")).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  const sidebarBackdrop = page.getByRole("button", { name: "Close sidebar" });
  const sidebarBackdropBox = (await sidebarBackdrop.boundingBox())!;
  await page.mouse.click(
    sidebarBackdropBox.x + sidebarBackdropBox.width - 8,
    sidebarBackdropBox.y + sidebarBackdropBox.height / 2,
  );
  await note.hover();
  await note.locator("summary").click();
  await note.getByRole("button", { name: "Organize" }).click();
  await expect.poll(async () => {
    const box = await drawer.boundingBox();
    return box ? Math.round(box.x + box.width) : null;
  }).toBe(382);
  const narrowDrawerBox = (await drawer.boundingBox())!;
  expect(narrowDrawerBox.x).toBe(8);
  expect(narrowDrawerBox.height).toBe(828);
  await page.keyboard.press("Escape");
});

test("image inset outlines follow the rounded preview in both themes", async ({ page }) => {
  const card = page.locator(".library-card").first();
  const image = card.locator("img");
  await expect(image).toBeVisible();
  await expect(card).toHaveCSS("border-radius", "20px");
  await expect(card).toHaveCSS("padding", "8px");
  await expect(image).toHaveCSS("border-radius", "12px");
  await expect(image).toHaveCSS("outline-offset", "-1px");
  await expect(image).toHaveCSS("outline-width", "1px");
  await page.getByRole("combobox", { name: "Theme" }).selectOption("light");
  await expect(image).toHaveCSS("outline-color", "rgba(0, 0, 0, 0.1)");
  await page.getByRole("combobox", { name: "Theme" }).selectOption("dark");
  await expect(image).toHaveCSS("outline-color", "rgba(255, 255, 255, 0.1)");
});

test("card actions, tag disclosure, selection and collection context work", async ({ page }) => {
  const note = page.locator(".library-card").filter({ hasText: "Design notes" });
  const tagControl = note.locator(".library-card-tag-control");
  await page.mouse.move(0, 0);
  await expect(tagControl).toHaveCSS("opacity", "1");
  const heightBeforeTags = (await note.boundingBox())!.height;
  await note.getByRole("button", { name: "1 tag" }).click();
  await expect(note.getByRole("button", { name: "minimal", exact: true })).toBeVisible();
  await expect(note.locator("..")).toHaveCSS("z-index", "40");
  const removeTag = note.getByRole("button", { name: "Remove tag minimal" });
  await expect(removeTag).toBeVisible();
  await expect(removeTag.locator("svg")).toHaveCount(1);
  await removeTag.click();
  const confirmRemove = note.getByRole("button", { name: "Confirm remove tag minimal" });
  await expect(confirmRemove).toBeVisible();
  await confirmRemove.click();
  await expect(note.getByRole("button", { name: "1 tag" })).toHaveCount(0);
  expect((await note.boundingBox())!.height).toBe(heightBeforeTags);
  await note.hover();
  await note.locator("summary").click();
  await note.getByRole("button", { name: "Edit", exact: true }).click();
  await note.getByRole("button", { name: "Cancel edit" }).click();
  await expect(note.getByRole("button", { name: "Edit", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(note.locator("summary")).toBeFocused();
  await page.keyboard.press("Enter");
  await note.getByRole("button", { name: "Edit", exact: true }).click();
  await note.getByLabel("Note content").fill("Updated note body");
  await note.getByRole("button", { name: "Save note" }).click();
  await expect(note.getByRole("button", { name: "Read Design notes" })).toContainText("Updated note body");
  await note.hover();
  await note.getByRole("checkbox").check();
  await expect(note.getByRole("checkbox")).toBeChecked();
  await note.getByRole("checkbox").uncheck();
  await page.getByLabel("UI inspiration", { exact: true }).click();
  await expect(note.getByRole("list", { name: "Collections" })).toHaveCount(0);
  await note.hover();
  await note.locator("summary").click();
  await note.getByRole("button", { name: "Pin", exact: true }).click();
  const pinnedStatus = note.getByTitle("Pinned in this collection");
  await expect(pinnedStatus).toBeVisible();
  await expect(pinnedStatus.locator("xpath=..")).toContainText("Design notes");
  await expect(note.getByRole("button", { name: "Unpin", exact: true })).toBeVisible();
});

test("opening one card menu closes the menu left open on another card", async ({ page }) => {
  const first = page.locator(".library-card").filter({ hasText: "Customer support" });
  const second = page.locator(".library-card").filter({ hasText: "Design notes" });

  await first.hover();
  await first.locator("summary").click();
  await expect(first.getByRole("button", { name: "Edit", exact: true })).toBeVisible();

  await second.hover();
  await second.locator("summary").click();
  await expect(second.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  await expect(first.getByRole("button", { name: "Edit", exact: true })).toBeHidden();

  await first.locator(".library-card-tag-control > button").click();
  await expect(second.getByRole("button", { name: "Edit", exact: true })).toBeHidden();
});

test("selecting a card keeps the library still and draws the state inside the card", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const heading = page.getByRole("heading", { name: "All items", exact: true });
  const header = page.locator("header").filter({ has: page.locator("#library-heading") });
  const layoutControls = page.getByRole("group", { name: "Library layout" });
  const card = page.locator(".library-card").filter({ hasText: "Customer support" });
  const headerBefore = (await header.boundingBox())!;
  const cardBefore = (await card.boundingBox())!;
  const shadowBefore = await card.evaluate(element => getComputedStyle(element).boxShadow);

  await card.hover();
  await card.getByRole("checkbox").check();

  const bulkActions = page.getByRole("region", { name: "Bulk actions" });
  await expect(bulkActions).toBeVisible();
  const headerAfter = (await header.boundingBox())!;
  const cardAfter = (await card.boundingBox())!;
  expect(headerAfter.height).toBe(headerBefore.height);
  expect(cardAfter.y).toBe(cardBefore.y);

  const headingBounds = (await heading.boundingBox())!;
  const bulkBounds = (await bulkActions.boundingBox())!;
  const layoutBounds = (await layoutControls.boundingBox())!;
  expect(bulkBounds.x).toBeGreaterThanOrEqual(headingBounds.x + headingBounds.width);
  expect(bulkBounds.x + bulkBounds.width).toBeLessThanOrEqual(layoutBounds.x);

  await bulkActions.getByRole("button", { name: "Add tag" }).click();
  const addTagDrawer = page.getByRole("dialog", {
    name: "Add tag to 1 selected item",
  });
  await expect(addTagDrawer).toBeVisible();
  expect((await header.boundingBox())!.height).toBe(headerAfter.height);
  expect((await card.boundingBox())!.y).toBe(cardAfter.y);
  await page.keyboard.press("Escape");
  await expect(addTagDrawer).toBeHidden();

  await bulkActions.getByRole("button", { name: "Remove tag" }).click();
  const removeTagDrawer = page.getByRole("dialog", {
    name: "Remove tag from 1 selected item",
  });
  await expect(removeTagDrawer).toBeVisible();
  expect((await header.boundingBox())!.height).toBe(headerAfter.height);
  expect((await card.boundingBox())!.y).toBe(cardAfter.y);
  await page.keyboard.press("Escape");
  await expect(removeTagDrawer).toBeHidden();

  await expect(card).toHaveCSS("outline-style", "none");
  const lightSelection = await card.evaluate(element => getComputedStyle(element).boxShadow);
  expect(lightSelection).not.toBe(shadowBefore);

  await page.getByRole("combobox", { name: "Theme" }).selectOption("dark");
  await expect.poll(() => card.evaluate(element => getComputedStyle(element).boxShadow))
    .not.toBe(lightSelection);

  await page.setViewportSize({ width: 320, height: 900 });
  const closeNavigation = page.getByRole("button", { name: "Close navigation", exact: true });
  if (await closeNavigation.isVisible()) await closeNavigation.click();
  await expect(bulkActions).toBeVisible();
  await expect(bulkActions.getByRole("button", { name: "Deselect all" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Filter by type" })).toBeVisible();
  await expect(layoutControls).toBeVisible();
  await expect(page.getByRole("button", { name: "Sort library" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("masonry places the next card below a shorter card, not a full row", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("items", "readwrite");
      for (let i = 0; i < 2; i++) tx.objectStore("items").put({ id: `packing-${i}`, type: "note", title: `Packing note ${i}`, content: "A short observation.", createdAt: -i, updatedAt: 1, collectionIds: [], tagIds: [] });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  const cards = page.locator(".library-card");
  await expect(cards).toHaveCount(6);
  await expectCardsNotToOverlap(page);
  await expect(async () => {
    const boxes = await cards.evaluateAll(nodes => nodes.map(node => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    }));
    const tallestBottom = Math.max(...boxes.slice(0, 3).map(box => box.y + box.height));
    expect(boxes.slice(3).some(box => box.y < tallestBottom + 19)).toBe(true);
  }).toPass({ timeout: 5000 });
});

test("masonry remeasures expanded cards and resizing without losing drafts", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const note = page.locator(".library-card").filter({ hasText: "Design notes" });
  await note.hover();
  await note.locator("summary").click();
  await note.getByRole("button", { name: "Edit", exact: true }).click();
  await note.getByLabel("Note content").fill("Keep this unsaved draft while resizing.");
  await expectCardsNotToOverlap(page);
  await page.getByRole("button", { name: "Collapse", exact: true }).click();
  for (const width of [1024, 640, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(note.getByLabel("Note content")).toHaveValue("Keep this unsaved draft while resizing.");
    await expectCardsNotToOverlap(page);
    expect(await page.locator("main").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await note.getByRole("button", { name: "Cancel edit" }).click();
  await expectCardsNotToOverlap(page);
});

test("masonry preserves ordering through search, sorting and view switching", async ({ page }) => {
  const headings = page.locator(".library-card").getByRole("heading");
  await expect(headings).toHaveText(["Customer support", "Design notes", "Footer reference", "example.com/fallback"]);
  await page.getByRole("button", { name: "Sort library" }).click();
  await page.getByRole("option", { name: "Oldest", exact: true }).click();
  await expect(headings).toHaveText(["example.com/fallback", "Footer reference", "Design notes", "Customer support"]);
  await expectCardsNotToOverlap(page);
  await page.getByLabel("Search", { exact: true }).fill("Design notes");
  await expect(headings).toHaveText(["Design notes"]);
  await page.getByLabel("Search", { exact: true }).fill("");
  await expect(headings).toHaveCount(4);
  await page.getByRole("button", { name: "List view" }).click();
  await expect(page.locator(".library-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Grid view" }).click();
  await expect(headings).toHaveCount(4);
  await expectCardsNotToOverlap(page);
});

test("list rows use open surfaces with thumbnails, excerpts and collection context", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "List view" }).click();
  const rows = page.locator(".library-list-row");
  await expect(rows).toHaveCount(4);
  const image = rows.filter({ hasText: "Customer support" });
  const note = rows.filter({ hasText: "Design notes" });
  const link = rows.filter({ hasText: "Footer reference" });
  await expect(image).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(image).toHaveCSS("border-top-width", "0px");
  await expect(image).toHaveCSS("border-bottom-width", "1px");
  await expect(image.locator('img[src^="blob:"]')).toBeVisible();
  await expect(link.locator('img[src^="blob:"]')).toBeVisible();
  await expect(note.getByRole("button", { name: "Open Design notes", exact: true })).toContainText("Let the image lead.");
  await expect(link).toContainText("A spacious footer for a portfolio.");
  await expect(note.getByLabel("Collections", { exact: true })).toContainText("UI inspiration");
  await expect(note.getByRole("button", { name: "minimal", exact: true })).toBeVisible();
  await page
    .getByRole("complementary", { name: "Sidebar" })
    .getByRole("button", { name: "UI inspiration", exact: true })
    .click();
  await expect(note.getByLabel("Collections", { exact: true })).toHaveCount(0);
});

test("list menus support editing, cancel-delete, selection and collection pinning", async ({ page }) => {
  await page.getByRole("button", { name: "List view" }).click();
  const note = page.locator(".library-list-row").filter({ hasText: "Design notes" });
  await page.mouse.move(0, 0);
  await expect(note.locator("details")).toHaveCSS("opacity", "0");
  await note.locator("summary").focus();
  await expect(note.locator("details")).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  await note.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(note.getByLabel("Note content")).toBeFocused();
  await note.getByLabel("Note content").fill("Updated from the open list.");
  await note.getByRole("button", { name: "Save note" }).click();
  await expect(note).toContainText("Updated from the open list.");
  await note.hover();
  await note.locator("summary").click();
  await note.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(note.getByRole("button", { name: "Confirm delete" })).toBeFocused();
  await note.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(note.getByRole("button", { name: "Delete", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await note.getByRole("checkbox").check();
  await expect(note.getByRole("checkbox")).toBeChecked();
  await note.getByRole("checkbox").uncheck();
  await page
    .getByRole("complementary", { name: "Sidebar" })
    .getByRole("button", { name: "UI inspiration", exact: true })
    .click();
  await note.hover();
  await note.locator("summary").click();
  await note.getByRole("button", { name: "Pin", exact: true }).click();
  await expect(note.getByText("Pinned in this collection", { exact: true })).toBeAttached();
  await expect(note.getByRole("button", { name: "Unpin", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await note.getByRole("button", { name: "Open Design notes", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

for (const width of [320, 768, 1024, 1440]) {
  test(`open list fits at ${width}px in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const close = page.getByRole("button", { name: "Close navigation", exact: true });
    if (width < 768) {
      await expect(close).toBeVisible();
      await close.click();
    }
    await page.getByRole("button", { name: "List view" }).click();
    const row = page.locator(".library-list-row").first();
    for (const theme of ["light", "dark"]) {
      await page.getByRole("combobox", { name: "Theme" }).selectOption(theme);
      await expect(row).toBeVisible();
      expect(await page.locator("main").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await row.hover();
      await row.locator("summary").click();
      await expect(row.getByRole("button", { name: "Edit", exact: true })).toBeInViewport();
      await row.locator("summary").press("Escape");
    }
  });
}

test("opening and closing an image keeps the masonry card in place", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const card = page.locator(".library-card").filter({ has: page.getByRole("heading", { name: "Customer support" }) });
  await expect(card.locator("img")).toBeVisible();
  await card.locator("img").evaluate(img => (img as HTMLImageElement).decode());
  const before = (await card.boundingBox())!;
  await card.getByRole("button", { name: "Open Customer support", exact: true }).click();
  const detail = page.getByRole("dialog");
  await expect(detail).toBeVisible();
  await expect(detail.locator("img").first()).toBeVisible();
  await detail.getByRole("button", { name: "Close", exact: true }).click();
  await expect(detail).toBeHidden();
  await expect(async () => {
    const after = (await card.boundingBox())!;
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);
  }).toPass({ timeout: 5000 });
  await expectCardsNotToOverlap(page);
});

test("a large library keeps measured card virtualization and reaches the last card", async ({ page }) => {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("items", "readwrite");
      for (let i = 0; i < 120; i++) tx.objectStore("items").put({ id: `extra-${i}`, type: "note", title: `Reference ${i}`, content: "Design observation. ".repeat(1 + i % 15), createdAt: 1000 + i, updatedAt: 1, collectionIds: [], tagIds: [] });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Reference 119", exact: true })).toBeVisible();
  expect(await page.locator(".library-card").count()).toBeLessThan(124);
  const main = page.locator("main");
  // Scrolling changes the total estimate as variable-height rows are measured.
  await expect(async () => {
    await main.evaluate(el => el.scrollTo(0, el.scrollHeight));
    await expect(page.getByRole("heading", { name: "example.com/fallback", exact: true })).toBeInViewport();
  }).toPass();
  expect(await page.locator(".library-card").count()).toBeLessThan(124);
  expect(await main.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expectCardsNotToOverlap(page);
  await page
    .getByRole("complementary", { name: "Sidebar" })
    .getByRole("button", { name: "UI inspiration", exact: true })
    .click();
  await expect(page.locator(".library-card")).toHaveCount(4);
  await expect.poll(() => main.evaluate(el => el.scrollTop)).toBe(0);
  await expectCardsNotToOverlap(page);
  await page.getByRole("button", { name: "All items", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Reference 119", exact: true })).toBeVisible();
  expect(await page.locator(".library-card").count()).toBeLessThan(124);
  await page.getByRole("button", { name: "List view" }).click();
  await expect(page.locator(".library-list-row").first()).toBeVisible();
  expect(await page.locator(".library-list-row").count()).toBeLessThan(124);
  await expect(async () => {
    await main.evaluate(el => el.scrollTo(0, el.scrollHeight));
    await expect(page.locator(".library-list-row").filter({ hasText: "example.com/fallback" })).toBeInViewport();
  }).toPass({ timeout: 10000 });
  expect(await page.locator(".library-list-row").count()).toBeLessThan(124);
});

for (const width of [320, 768, 1024]) {
  test(`cards fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(".library-card").first()).toBeVisible();
    await expect.poll(() => page.locator("main").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test.describe("touch card controls", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("actions remain visible and open without hover", async ({ page }) => {
    const closeNavigation = page.getByRole("button", { name: "Close navigation", exact: true });
    await expect(closeNavigation).toBeVisible();
    await closeNavigation.tap();
    const card = page.locator(".library-card").first();
    await expect(card.locator("details")).toHaveCSS("opacity", "1");
    await expect(card.locator(".library-card-tag-control")).toHaveCSS("opacity", "1");
    await card.getByRole("button", { name: "1 tag" }).tap();
    await expect(card.getByRole("button", { name: "minimal", exact: true })).toBeVisible();
    await card.locator("summary").tap();
    await expect(card.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    await expect(card.getByRole("button", { name: "Delete", exact: true })).toBeInViewport();
  });

  test("list actions and selection work without hover", async ({ page }) => {
    await page.getByRole("button", { name: "Close navigation", exact: true }).tap();
    await page.getByRole("button", { name: "List view" }).tap();
    const row = page.locator(".library-list-row").first();
    await expect(row.locator("details")).toHaveCSS("opacity", "1");
    await row.getByRole("checkbox").check();
    await expect(row.getByRole("checkbox")).toBeChecked();
    await row.getByRole("checkbox").uncheck();
    await row.locator("summary").tap();
    await expect(row.getByRole("button", { name: "Edit", exact: true })).toBeInViewport();
  });
});

test("list thumbnail and action placement mirror in RTL", async ({ page }) => {
  await page.getByRole("button", { name: "List view" }).click();
  await page.evaluate(() => { document.documentElement.dir = "rtl"; });
  const row = page.locator(".library-list-row").first();
  await row.hover();
  const bounds = (await row.boundingBox())!;
  const thumbnail = (await row.locator(".library-list-thumbnail").boundingBox())!;
  const actions = (await row.locator("summary").boundingBox())!;
  expect(Math.abs(thumbnail.x + thumbnail.width - bounds.x - bounds.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(actions.x - bounds.x)).toBeLessThanOrEqual(1);
  await row.locator("summary").click();
  await expect(row.getByRole("button", { name: "Edit", exact: true })).toBeInViewport();
});

test("action controls mirror in RTL and respect reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => { document.documentElement.dir = "rtl"; });
  const card = page.locator(".library-card").first();
  await card.hover();
  const actions = card.locator("details");
  await expect(actions).toHaveCSS("transition-duration", "0s");
  const cardBox = (await card.boundingBox())!;
  const triggerBox = (await actions.locator("summary").boundingBox())!;
  expect(triggerBox.x - cardBox.x).toBeCloseTo(12, 0);
  await actions.locator("summary").click();
  await expect(card.getByRole("button", { name: "Edit", exact: true })).toBeInViewport();
});
