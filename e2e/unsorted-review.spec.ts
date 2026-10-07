import { test, expect, type Locator, type Page } from "@playwright/test";
import { pdfFixture } from "../test-support/pdf-fixture";

test.use({ serviceWorkers: "block" });

async function seed(page: Page, count = 3) {
  await page.addInitScript(() => localStorage.setItem("keepall-shell-panel-open", "closed"));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Save first item" })).toBeVisible();
  await page.evaluate(async (count) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["items", "collections", "tags"], "readwrite");
      for (let i = 0; i < count; i++) tx.objectStore("items").put({ id: `review-${i}`, type: "note", title: `Review item ${i + 1}`, content: `Saved note ${i + 1}. A long enough paragraph to preview while organizing the library.`, format: "plain", createdAt: 300 - i, updatedAt: 300 - i, collectionIds: [], tagIds: [] });
      tx.objectStore("collections").put({ id: "reading", name: "Reading", createdAt: 1, pinnedItemIds: [] });
      tx.objectStore("tags").put({ id: "reference", name: "Reference", createdAt: 1 });
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    }); db.close();
  }, count);
  await page.goto("/?unsorted=1");
  await expect(page.getByRole("button", { name: "Review Unsorted" })).toBeEnabled();
}

async function rows(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result); });
    const items = await new Promise<{ id: string; collectionIds: string[]; tagIds: string[]; deletedAt?: number }[]>(resolve => { const tx = db.transaction("items"); const request = tx.objectStore("items").getAll(); request.onsuccess = () => resolve(request.result); }); db.close(); return items;
  });
}

test("review and preview share inset content cards, centered actions and transparent progress pills", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Review Unsorted", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Review item 1", exact: true });
  let reviewSurface;
  for (const mode of ["review", "preview"]) {
    if (mode === "preview") {
      await dialog.getByRole("button", { name: "Close preview", exact: true }).click();
      await page.locator('[data-item-id="review-0"]').click({ button: "right" });
      await page.getByRole("menuitem", { name: "Preview", exact: true }).click();
    }
    for (const width of [1280, 640, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveCSS("transform", "none");
      await expect(dialog.getByRole("button", { name: "Skip", exact: true })).toHaveCount(0);
      const surface = dialog.locator(".library-preview-surface");
      const header = surface.locator("header");
      await expect(header.getByRole("heading", { name: "Review item 1", exact: true })).toBeVisible();
      await expect(header.getByRole("button", { name: "Close preview", exact: true })).toBeVisible();
      const style = await surface.evaluate(node => {
        const computed = getComputedStyle(node);
        return { background: computed.backgroundColor, border: computed.borderTop, radius: computed.borderRadius };
      });
      if (mode === "review") reviewSurface = style;
      else expect(style).toEqual(reviewSurface);
      const popupBox = (await dialog.boundingBox())!;
      const cardBox = (await surface.boundingBox())!;
      expect(Math.abs((cardBox.x - popupBox.x) - (popupBox.x + popupBox.width - cardBox.x - cardBox.width))).toBeLessThan(1);
      expect(cardBox.x - popupBox.x).toBeCloseTo(cardBox.y - popupBox.y, 0);
      const counter = surface.getByRole("status").filter({ hasText: "1 of 3" });
      await expect(counter).toBeVisible();
      await expect(counter).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      const counterBox = (await counter.boundingBox())!;
      expect(Math.abs(counterBox.x + counterBox.width / 2 - cardBox.x - cardBox.width / 2)).toBeLessThan(1);
      await expect.poll(() => counter.evaluate(node => {
        const card = node.closest(".library-preview-surface")!.getBoundingClientRect();
        const pill = node.getBoundingClientRect();
        return card.bottom - pill.bottom;
      })).toBeCloseTo(17, 0);
      const primary = dialog.getByRole("button", { name: mode === "review" ? "Apply changes" : "Open full item", exact: true });
      const actionBox = (await primary.boundingBox())!;
      expect(Math.abs(actionBox.x + actionBox.width / 2 - popupBox.x - popupBox.width / 2)).toBeLessThan(1);
      for (const name of ["Previous item", "Next item"]) {
        const action = dialog.getByRole("button", { name, exact: true });
        await expect(action.locator("svg")).toHaveCount(1);
        await expect(action).toHaveText(name === "Previous item" ? "Back" : "Next");
      }
      if (mode === "preview") {
        const backBox = (await dialog.getByRole("button", { name: "Previous item", exact: true }).boundingBox())!;
        const nextBox = (await dialog.getByRole("button", { name: "Next item", exact: true }).boundingBox())!;
        expect(backBox.x + backBox.width).toBeLessThan(actionBox.x + actionBox.width / 2);
        expect(nextBox.x).toBeGreaterThan(actionBox.x + actionBox.width / 2);
      }
      expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    }
  }
  await dialog.getByRole("button", { name: "Next item", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Review item 2", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open full item", exact: true }).click();
  await expect(page).toHaveURL(/items\/review-1/);
});

test("inline tag search and reserved chip rows keep review geometry stable while browsing and editing", async ({ page }) => {
  await seed(page, 4);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["items", "tags"], "readwrite");
      for (let index = 0; index < 30; index++) tx.objectStore("tags").put({ id: `layout-tag-${index}`, name: `Saved reference topic ${index + 1}`, createdAt: index + 2 });
      tx.objectStore("tags").put({ id: "unassigned-tag", name: "Unassigned bookmark", createdAt: 50 });
      for (let index = 0; index < 4; index++) {
        const request = tx.objectStore("items").get(`review-${index}`);
        request.onsuccess = () => tx.objectStore("items").put({ ...request.result, tagIds: Array.from({ length: [0, 1, 10, 30][index] }, (_, tag) => `layout-tag-${tag}`) });
      }
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    }); db.close();
  });
  await page.reload();
  await page.getByRole("button", { name: "Review Unsorted", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const geometry = () => dialog.evaluate(node => {
    const box = (selector: string) => {
      const rect = node.querySelector(selector)!.getBoundingClientRect();
      return { top: rect.top, height: rect.height };
    };
    return { content: box(".library-preview-surface"), organizer: box(".library-review-organizer"), controls: box(".library-review-controls"), tags: box('[aria-label="Tags"]') };
  });
  for (const [width, height] of [[1280, 900], [320, 720], [640, 450]]) {
    await page.setViewportSize({ width, height });
    await expect(dialog).toHaveCSS("transform", "none");
    const baseline = await geometry();
    for (let index = 0; index < 4; index++) {
      await expect(dialog.getByRole("heading", { name: `Review item ${index + 1}`, exact: true })).toBeVisible();
      await expect(dialog.getByRole("textbox", { name: "Review tags", exact: true })).toHaveAttribute("placeholder", "Find a tag…");
      const input = dialog.getByRole("textbox", { name: "Review tags", exact: true });
      expect(await input.evaluate(node => [...node.parentElement!.querySelectorAll("button")].some(button => button.textContent === "Browse all tags"))).toBe(true);
      const current = await geometry();
      for (const key of ["content", "organizer", "controls", "tags"] as const) {
        expect(current[key].top).toBeCloseTo(baseline[key].top, 0);
        expect(current[key].height).toBeCloseTo(baseline[key].height, 0);
      }
      if (index < 3) await dialog.getByRole("button", { name: "Next item", exact: true }).click();
    }
    const tagInput = dialog.getByRole("textbox", { name: "Review tags", exact: true });
    await tagInput.scrollIntoViewIfNeeded();
    await tagInput.focus();
    const beforeSearch = await geometry();
    const inputBox = (await tagInput.boundingBox())!;
    await tagInput.fill("Unlisted new tag");
    const create = dialog.getByRole("button", { name: "Create tag “Unlisted new tag”", exact: true });
    await expect(create).toBeVisible();
    await expect(dialog.getByText("No matching tags.", { exact: true })).toHaveCount(0);
    expect(await create.evaluate(node => node.closest('ul[aria-label="Tags"]') !== null)).toBe(true);
    await expect(dialog.getByRole("button", { name: "Browse all tags", exact: true })).toBeVisible();
    await expect(dialog.locator('ul[aria-label="Tags"] > li')).toHaveCount(1);
    const afterSearch = await geometry();
    expect(afterSearch).toEqual(beforeSearch);
    expect((await tagInput.boundingBox())!.width).toEqual(inputBox.width);
    await tagInput.fill("Unassigned");
    await expect(dialog.getByRole("button", { name: "Unassigned bookmark", exact: true })).toBeVisible();
    await expect(create).toHaveCount(0);
    expect(await geometry()).toEqual(beforeSearch);
    await tagInput.fill("");
    const collectionInput = dialog.getByRole("textbox", { name: "Review collection", exact: true });
    await collectionInput.scrollIntoViewIfNeeded();
    await collectionInput.focus();
    const beforeCollectionSearch = await geometry();
    const collectionBox = (await dialog.locator('ul[aria-label="Collections"]').boundingBox())!;
    await collectionInput.fill("Unlisted new collection");
    const createCollection = dialog.getByRole("button", { name: "Create collection “Unlisted new collection”", exact: true });
    await expect(createCollection).toBeVisible();
    expect(await createCollection.evaluate(node => node.closest('ul[aria-label="Collections"]') !== null)).toBe(true);
    await expect(dialog.getByRole("button", { name: "Browse all folders", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Unsorted", exact: true })).toHaveCount(0);
    await expect(dialog.locator('ul[aria-label="Collections"] > li')).toHaveCount(1);
    await expect(dialog.getByText("No matching collections.", { exact: true })).toHaveCount(0);
    expect(await geometry()).toEqual(beforeCollectionSearch);
    expect((await createCollection.boundingBox())!.y).toEqual(collectionBox.y);
    await collectionInput.fill("");
    await expect(dialog.getByRole("button", { name: "Unsorted", exact: true })).toBeVisible();
    const remove = dialog.getByRole("button", { name: "Remove tag Saved reference topic 1", exact: true });
    await remove.click();
    await expect(remove).toHaveCount(0);
    const afterRemoval = await geometry();
    expect(afterRemoval.content).toEqual(baseline.content);
    expect(afterRemoval.tags.height).toEqual(baseline.tags.height);
    await dialog.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(remove).toBeVisible();
    for (let step = 0; step < 3; step++) await dialog.getByRole("button", { name: "Previous item", exact: true }).click();
  }
  await dialog.getByRole("textbox", { name: "Review tags", exact: true }).fill("New review tag");
  await dialog.getByRole("button", { name: "Create tag “New review tag”", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Remove tag New review tag", exact: true })).toBeVisible();
  await expect.poll(async () => (await rows(page)).find(row => row.id === "review-0")?.tagIds.length).toBe(1);
});

test("PDF zoom menu opens above review and preview and applies the selected zoom", async ({ page }) => {
  await seed(page, 1);
  await page.evaluate(async bytes => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["items", "documentAssets"], "readwrite");
        tx.objectStore("items").put({ id: "review-0", type: "document", format: "pdf", title: "Review PDF", sourceFileName: "review.pdf", assetId: "review-pdf", noteContent: "", collectionIds: [], tagIds: [], createdAt: 300, updatedAt: 300 });
        tx.objectStore("documentAssets").put({ id: "review-pdf", bytes: new Uint8Array(bytes), byteLength: bytes.length, contentHash: "review-pdf", pdfText: "First page Second page", createdAt: 300 });
        tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, Array.from(pdfFixture(["First page", "Second page"])));
  await page.reload();
  await page.getByRole("button", { name: "Review Unsorted", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Review PDF", exact: true });
  for (const mode of ["review", "preview"]) {
    if (mode === "preview") {
      await dialog.getByRole("button", { name: "Close preview", exact: true }).click();
      await page.locator('[data-item-id="review-0"]').click({ button: "right" });
      await page.getByRole("menuitem", { name: "Preview", exact: true }).click();
    }
    await expect(dialog.getByRole("img", { name: "PDF page 1", exact: true })).toBeVisible();
    const trigger = dialog.getByRole("combobox", { name: "PDF zoom: Fit width", exact: true });
    await expect(trigger).toBeEnabled();
    await trigger.click();
    const menu = page.getByRole("listbox", { name: "PDF zoom", exact: true });
    const option = menu.getByRole("option", { name: "150%", exact: true });
    await expect(option).toBeVisible();
    expect(await option.evaluate(node => {
      const bounds = node.getBoundingClientRect();
      return node.contains(document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2));
    }), `PDF zoom options must be clickable above ${mode}`).toBe(true);
    await option.click();
    await expect(dialog.getByRole("combobox", { name: "PDF zoom: 150%", exact: true })).toBeVisible();
    await expect(menu).toBeHidden();
    await expect(dialog.getByRole("img", { name: "PDF page 1", exact: true })).toBeVisible();
    await dialog.getByRole("combobox", { name: "PDF zoom: 150%", exact: true }).click();
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Review PDF", exact: true })).toBeVisible();
  }
});

test("Apply changes visibly brightens on hover and keeps disabled and press feedback", async ({ page }) => {
  await seed(page, 1);
  await page.getByRole("button", { name: "Review Unsorted", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Review item 1", exact: true });
  const apply = dialog.getByRole("button", { name: "Apply changes", exact: true });
  const appearance = () => apply.evaluate(node => {
    const style = getComputedStyle(node);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    const rgb = (color: string) => {
      context.fillStyle = color; context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
    };
    const luminance = (color: string) => rgb(color).map(value => {
      const channel = value / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const background = luminance(style.backgroundColor), text = luminance(style.color);
    return { background: style.backgroundColor, text: style.color, luminance: background,
      contrast: (Math.max(background, text) + .05) / (Math.min(background, text) + .05) };
  });
  await expect(apply).toBeDisabled();
  const disabled = await appearance();
  await apply.hover();
  await expect(apply).toHaveCSS("background-color", disabled.background);
  await expect(apply).toHaveCSS("opacity", "0.6");
  await dialog.getByRole("button", { name: "Reading", exact: true }).click();
  await page.mouse.move(0, 0);
  await expect(apply).toBeEnabled();
  const rest = await appearance();
  expect(rest.contrast).toBeGreaterThan(4.5);
  await apply.hover();
  const visibleIncrease = rest.luminance > .1 ? .2 : .01;
  await expect.poll(async () => (await appearance()).luminance).toBeGreaterThan(rest.luminance + visibleIncrease);
  const hover = await appearance();
  expect(hover.background).not.toEqual(rest.background);
  expect(hover.contrast).toBeGreaterThan(4.5);
  await expect(apply).toHaveCSS("color", rest.text);
  await expect(apply).toHaveCSS("opacity", "1");
  expect(await apply.evaluate(node => getComputedStyle(node).transitionProperty)).toContain("background-color");
  await page.mouse.down();
  await expect(apply).toHaveCSS("transform", "matrix(0.96, 0, 0, 0.96, 0, 0)");
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await expect(apply).toHaveCSS("transform", "none");
  await expect(apply).toHaveCSS("background-color", rest.background);
  await expect(dialog).toBeVisible();
});

test("Delete matches the selected-card toolbar Move to Trash in every interaction state", async ({ page }) => {
  await seed(page, 1);
  const appearance = (button: Locator) => button.evaluate(node => {
    const style = getComputedStyle(node);
    return { background: style.backgroundColor, color: style.color, border: style.borderTopColor,
      radius: style.borderRadius, opacity: style.opacity, transition: style.transitionProperty,
      outline: style.outline, transform: style.transform };
  });
  const states = async (button: Locator) => {
    await page.mouse.move(0, 0);
    await button.evaluate(node => (node as HTMLElement).blur());
    const rest = await appearance(button);
    await button.hover();
    const hover = await appearance(button);
    await page.mouse.down();
    await expect(button).toHaveCSS("transform", "matrix(0.96, 0, 0, 0.96, 0, 0)");
    const press = await appearance(button);
    await page.mouse.move(0, 0); await page.mouse.up();
    await expect(button).toHaveCSS("transform", "none");
    // Enable keyboard modality without racing the dialog's Tab focus manager.
    await page.keyboard.press("Shift");
    await button.focus();
    await expect(button).toBeFocused();
    expect(await button.evaluate(node => node.matches(":focus-visible"))).toBe(true);
    const focus = await appearance(button);
    await button.evaluate(node => { (node as HTMLButtonElement).disabled = true; });
    await expect(button).toHaveCSS("opacity", "0.6");
    const disabled = await appearance(button);
    await button.evaluate(node => { (node as HTMLButtonElement).disabled = false; });
    return { rest, hover, press, focus, disabled };
  };
  const select = page.getByRole("checkbox", { name: "Select Review item 1", exact: true });
  await select.focus(); await page.keyboard.press("Space");
  await expect(select).toBeChecked();
  const toolbar = page.getByRole("button", { name: "Move to Trash", exact: true });
  const expected = await states(toolbar);
  await page.getByRole("button", { name: "Deselect all", exact: true }).click();
  await page.getByRole("button", { name: "Review Unsorted", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Review item 1", exact: true });
  const remove = review.getByRole("button", { name: "Delete", exact: true });
  expect(await states(remove)).toEqual(expected);
  await remove.click();
  const confirm = page.getByRole("dialog", { name: "Move to Trash?", exact: true });
  await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(review).toBeVisible();
  expect((await rows(page))[0].deletedAt).toBeUndefined();
});

test("reviews tags, navigation, filing, deletion and Undo through the last queue position", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await seed(page);
  await page.getByRole("button", { name: "Review Unsorted" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Review item 1" })).toBeVisible();
  await dialog.getByRole("button", { name: "Browse all tags", exact: true }).click();
  const tagSearch = page.getByRole("menu", { name: "Browse all tags", exact: true }).getByRole("textbox", { name: "Search tags", exact: true });
  await tagSearch.fill("Reference");
  await tagSearch.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/items\//);
  await expect(dialog.getByRole("button", { name: "Remove tag Reference", exact: true })).toBeVisible();
  await expect(dialog.getByRole("status").filter({ hasText: "Item 1 of 3" })).toContainText("0 reviewed");
  await dialog.getByRole("button", { name: "Next item", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).not.toHaveURL(/items\//);
  await expect(dialog.getByRole("heading", { name: "Review item 2" })).toBeVisible();
  await dialog.getByRole("button", { name: "Browse all folders", exact: true }).click();
  const collectionSearch = page.getByRole("menu", { name: "Browse all folders", exact: true }).getByRole("textbox", { name: "Search collections", exact: true });
  await collectionSearch.fill("Reading");
  await collectionSearch.press("Enter");
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "Apply changes", exact: true }).click();
  await expect(page).not.toHaveURL(/items\//);
  await expect(dialog.getByRole("heading", { name: "Review item 3" })).toBeVisible();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("dialog", { name: "Move to Trash?", exact: true }).getByRole("button", { name: "Move to Trash", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "End of review" })).toBeVisible();
  await expect(dialog.getByRole("status").filter({ hasText: "2 of 3 reviewed" })).toBeVisible();
  await dialog.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Review item 3" })).toBeVisible();
  await expect.poll(async () => (await rows(page)).find(row => row.id === "review-2")?.deletedAt).toBeUndefined();
  await dialog.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Review item 2" })).toBeVisible();
  await expect.poll(async () => (await rows(page)).find(row => row.id === "review-1")?.collectionIds).toEqual([]);
  await dialog.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Review item 1" })).toBeVisible();
  await expect.poll(async () => (await rows(page)).find(row => row.id === "review-0")?.tagIds).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Review Unsorted" })).toBeFocused();
  expect(errors).toEqual([]);
});

test("review controls fit at 320px and a one-item queue keeps Undo after deletion", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await seed(page, 1);
  await page.getByRole("button", { name: "Review Unsorted" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Browse all folders", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
  const bounds = await dialog.boundingBox(); expect(bounds!.width).toBeLessThanOrEqual(320);
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  for (const label of ["Previous item", "Next item", "Apply changes", "Delete", "Undo"]) {
    const action = await dialog.getByRole("button", { name: label, exact: true }).boundingBox();
    expect(action!.y).toBeGreaterThanOrEqual(bounds!.y);
    expect(action!.y + action!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height);
  }
  expect(await dialog.locator("footer").evaluate(node => node.scrollHeight <= node.clientHeight)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("review-mobile.png") });
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("dialog", { name: "Move to Trash?", exact: true }).getByRole("button", { name: "Move to Trash", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Review complete" })).toBeVisible();
  await dialog.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Review item 1" })).toBeVisible();
});

test("review Previous, Next and arrows browse without mutating items or requiring Undo", async ({ page }) => {
  await seed(page);
  const originals = await rows(page);
  await page.getByRole("button", { name: "Review Unsorted" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Previous item", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Next item", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Review item 2", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("heading", { name: "Review item 3", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Next item", exact: true })).toBeDisabled();
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.getByRole("heading", { name: "Review item 2", exact: true })).toBeVisible();
  expect(await rows(page)).toEqual(originals);
  await dialog.getByRole("button", { name: "Browse all folders", exact: true }).click();
  const picker = page.getByRole("menu", { name: "Browse all folders", exact: true });
  await picker.getByRole("textbox", { name: "Search collections" }).press("ArrowLeft");
  await expect(picker).toBeVisible();
  await picker.getByRole("menuitemradio", { name: "Reading", exact: true }).click();
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "Next item", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Apply changes", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Next item", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Skip", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("status").filter({ hasText: "Item 3 of 3" })).toContainText("0 reviewed");
  expect(await rows(page)).toEqual(originals);
});

test("review reuses searchable organizer choices and stages collection selection", async ({ page }, testInfo) => {
  await seed(page);
  await page.getByRole("button", { name: "Review Unsorted" }).click();
  const dialog = page.getByRole("dialog", { name: "Review item 1", exact: true });
  await expect(dialog.getByRole("button", { name: "Apply changes", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Browse all folders", exact: true }).click();
  const collectionPicker = page.getByRole("menu", { name: "Browse all folders", exact: true });
  await expect(collectionPicker.getByRole("menuitemradio", { name: "Unsorted", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(collectionPicker.getByRole("textbox", { name: "Search collections" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Browse all folders", exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "Browse all folders", exact: true }).click();
  await collectionPicker.getByRole("textbox", { name: "Search collections" }).fill("Read");
  await collectionPicker.getByRole("menuitemradio", { name: "Reading", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog.getByRole("button", { name: "Reading", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect((await rows(page)).find(row => row.id === "review-0")?.collectionIds).toEqual([]);
  await dialog.getByRole("button", { name: "Browse all tags", exact: true }).click();
  const tagPicker = page.getByRole("menu", { name: "Browse all tags", exact: true });
  await tagPicker.getByRole("textbox", { name: "Search tags" }).fill("Ref");
  await tagPicker.getByRole("menuitemcheckbox", { name: "Reference", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog.getByRole("button", { name: "Remove tag Reference", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Remove tag Reference", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Remove tag Reference", exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Remove tag Reference", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Browse all folders", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Reading", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog.getByRole("button", { name: "Apply changes", exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("review-shared-organizer-desktop.png") });
  await dialog.getByRole("button", { name: "Apply changes", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Review item 2", exact: true })).toBeVisible();
});

test("review limits folder and tag rows while content scrolls and actions stay visible", async ({ page }, testInfo) => {
  await seed(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["items", "tags", "collections"], "readwrite");
      for (let index = 0; index < 40; index++) {
        tx.objectStore("tags").put({ id: `dense-tag-${index}`, name: `Topic ${index + 1}`, createdAt: index + 2 });
        tx.objectStore("collections").put({ id: `dense-folder-${index}`, name: `Folder ${index + 1}`, createdAt: index + 2, pinnedItemIds: [] });
      }
      const request = tx.objectStore("items").get("review-0");
      request.onsuccess = () => tx.objectStore("items").put({ ...request.result, content: "A long saved article paragraph. ".repeat(300), tagIds: Array.from({ length: 12 }, (_, index) => `dense-tag-${index}`) });
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    }); db.close();
  });
  await page.reload();
  await page.getByRole("button", { name: "Review Unsorted" }).click();
  const dialog = page.getByRole("dialog");
  for (const [width, height] of [[1280, 900], [320, 720], [640, 450]]) {
    await page.setViewportSize({ width, height });
    const folderRow = dialog.getByRole("list", { name: "Collections", exact: true });
    const tagList = dialog.getByRole("list", { name: "Tags", exact: true });
    expect((await folderRow.boundingBox())!.height).toBeLessThanOrEqual(32);
    expect(await folderRow.getByRole("button").count()).toBe(7);
    await expect.poll(() => tagList.evaluate(node => new Set([...node.children].map(child => (child as HTMLElement).offsetTop)).size)).toBeLessThanOrEqual(2);
    const bounds = (await dialog.boundingBox())!;
    for (const label of ["Previous item", "Next item", "Apply changes", "Delete", "Undo"]) {
      const action = (await dialog.getByRole("button", { name: label, exact: true }).boundingBox())!;
      expect(action.y).toBeGreaterThanOrEqual(bounds.y);
      expect(action.y + action.height).toBeLessThanOrEqual(bounds.y + bounds.height);
    }
    for (const label of ["Previous item", "Next item", "Apply changes", "Delete", "Undo"]) {
      const spacing = await dialog.getByRole("button", { name: label, exact: true }).evaluate(node => {
        const icon = node.querySelector("svg")!.getBoundingClientRect();
        const text = [...node.childNodes].find(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim())!;
        const range = document.createRange(); range.selectNodeContents(text);
        const words = range.getBoundingClientRect();
        const button = node.getBoundingClientRect();
        const trailing = words.left < icon.left;
        const style = getComputedStyle(node);
        return {
          outside: trailing ? button.right - icon.right - parseFloat(style.borderRightWidth) : icon.left - button.left - parseFloat(style.borderLeftWidth),
          inside: trailing ? icon.left - words.right : words.left - icon.right,
        };
      });
      expect(Math.abs(spacing.outside - spacing.inside), `${label} at ${width}px: ${JSON.stringify(spacing)}`).toBeLessThanOrEqual(1);
    }
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    const content = dialog.getByRole("region", { name: "Preview content", exact: true }).locator('[data-slot="scroll-area-viewport"]');
    expect(await content.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
    await content.evaluate(node => { node.scrollTop = 100; });
    expect(await content.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath(`review-dense-${width}.png`) });
  }
  await dialog.getByRole("button", { name: "Browse all tags", exact: true }).click();
  const picker = page.getByRole("menu", { name: "Browse all tags", exact: true });
  await picker.getByRole("textbox", { name: "Search tags" }).fill("Topic 40");
  await picker.getByRole("menuitemcheckbox", { name: "Topic 40", exact: true }).click();
  await expect.poll(async () => (await rows(page)).find(row => row.id === "review-0")?.tagIds).toContain("dense-tag-39");
});

test("review creates from an unmatched inline search and confirms recoverable Trash moves", async ({ page }) => {
  await seed(page, 1);
  const originals = await rows(page);
  await page.getByRole("button", { name: "Review Unsorted" }).click();
  const review = page.getByRole("dialog", { name: "Review item 1", exact: true });
  await expect(review.getByRole("button", { name: "Reading", exact: true })).toBeVisible();
  const input = review.getByRole("textbox", { name: "Review collection", exact: true });
  await input.fill("Read");
  await expect(review.getByRole("button", { name: /Create collection/ })).toHaveCount(0);
  await review.getByRole("button", { name: "Reading", exact: true }).click();
  await expect(review.getByRole("button", { name: "Reading", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(review.getByRole("button", { name: "Apply changes", exact: true })).toBeEnabled();
  await input.fill("New folder");
  await review.getByRole("button", { name: "Create collection “New folder”", exact: true }).click();
  await expect(review.getByRole("button", { name: "New folder", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(review.getByRole("button", { name: "Apply changes", exact: true })).toBeEnabled();
  expect(await rows(page)).toEqual(originals);
  await review.getByRole("button", { name: "Delete", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Move to Trash?", exact: true });
  await expect(confirmation.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  expect(await rows(page)).toEqual(originals);
  await page.keyboard.press("Escape");
  await expect(confirmation).not.toBeVisible();
  await expect(review).toBeVisible();
  await expect(review.getByRole("button", { name: "Delete", exact: true })).toBeFocused();
  await review.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await rows(page)).toEqual(originals);
  await review.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmation.getByRole("button", { name: "Move to Trash", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review complete", exact: true })).toBeVisible();
  await expect.poll(async () => (await rows(page))[0]?.deletedAt).toEqual(expect.any(Number));
  expect((await rows(page))[0]?.id).toBe("review-0");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(review).toBeVisible();
  const restored = (await rows(page))[0];
  expect(restored.deletedAt).toBeUndefined();
  expect(restored).toMatchObject({ ...originals[0], updatedAt: expect.any(Number) });
});

test("review content card includes its header with equal insets and compact image controls", async ({ page }, testInfo) => {
  await seed(page, 2);
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas"); canvas.width = 800; canvas.height = 500;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#49679b"; context.fillRect(0, 0, 800, 500);
    context.fillStyle = "#c4d3f0"; context.fillRect(48, 48, 704, 404);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), "image/png"));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const db = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["items", "assets"], "readwrite");
      for (const id of ["review-image-a", "review-image-b"]) tx.objectStore("assets").put({ id, bytes, mimeType: blob.type, byteLength: blob.size, contentHash: id, createdAt: 1 });
      for (let index = 0; index < 2; index++) tx.objectStore("items").put({ id: `review-${index}`, type: "image", title: index === 0 ? "Single image" : "Image gallery", assetIds: index === 0 ? ["review-image-a"] : ["review-image-a", "review-image-b"], sourceUrl: "", createdAt: 300 - index, updatedAt: 300 - index, collectionIds: [], tagIds: [] });
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    }); db.close();
  });
  await page.reload();
  await page.getByRole("button", { name: "Review Unsorted" }).click();
  const dialog = page.getByRole("dialog");
  for (const [width, height] of [[1280, 900], [320, 720]]) {
    await page.setViewportSize({ width, height });
    const surface = dialog.locator(".library-review-content");
    await expect(surface.getByRole("heading", { name: "Single image", exact: true })).toBeVisible();
    await expect(surface.getByRole("button", { name: "Close preview", exact: true })).toBeVisible();
    await expect(surface.getByRole("button", { name: "Previous gallery image", exact: true })).toHaveCount(0);
    await expect(surface.getByRole("button", { name: "Next gallery image", exact: true })).toHaveCount(0);
    const bounds = (await dialog.boundingBox())!;
    const card = (await surface.boundingBox())!;
    const footer = (await dialog.locator("footer").boundingBox())!;
    for (const distance of [card.x - bounds.x, bounds.x + bounds.width - card.x - card.width, card.y - bounds.y, bounds.y + bounds.height - footer.y - footer.height]) expect(distance).toBeCloseTo(17, 0);
    const icon = (await surface.locator("header > span").boundingBox())!;
    const close = (await surface.getByRole("button", { name: "Close preview", exact: true }).boundingBox())!;
    expect(icon.x - card.x).toBeCloseTo(17, 0);
    expect(icon.y - card.y).toBeCloseTo(17, 0);
    expect(card.x + card.width - close.x - close.width).toBeCloseTo(17, 0);
    await surface.getByRole("button", { name: "Scroll image", exact: true }).click();
    await surface.getByRole("button", { name: "Fit image", exact: true }).click();
    await expect(surface.locator('[data-preview-media] img')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`review-image-${width}.png`) });
  }
  await dialog.getByRole("button", { name: "Next item", exact: true }).click();
  const surface = dialog.locator(".library-review-content");
  await expect(surface.getByRole("heading", { name: "Image gallery", exact: true })).toBeVisible();
  expect((await surface.getByRole("button", { name: "Next gallery image", exact: true }).boundingBox())!.height).toBe(36);
  expect((await surface.getByRole("group", { name: "Image sizing", exact: true }).boundingBox())!.height).toBe(36);
  await surface.getByRole("button", { name: "Next gallery image", exact: true }).click();
  await expect(surface.getByText("Image 2 of 2", { exact: true })).toBeVisible();
  await surface.getByRole("button", { name: "Previous gallery image", exact: true }).click();
  await expect(surface.getByText("Image 1 of 2", { exact: true })).toBeVisible();
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("review-gallery-mobile.png") });
  await page.setViewportSize({ width: 1707, height: 825 });
  await page.screenshot({ path: testInfo.outputPath("review-gallery-desktop.png") });
  await dialog.getByRole("button", { name: "Close preview", exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('[data-item-id="review-1"]').click({ button: "right" });
  await page.getByRole("menuitem", { name: "Preview", exact: true }).click();
  const preview = page.getByRole("dialog");
  await expect(preview.locator(".library-review-content")).toHaveCount(0);
  await expect(preview.getByRole("button", { name: "Open full item", exact: true })).toBeVisible();
  await expect(preview.getByRole("button", { name: "Next gallery image", exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Scroll image", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Scroll image", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("shortcut editing records, cancels, validates and saves before the app uses a new binding", async ({ page }, testInfo) => {
  await page.goto("/settings#keyboard-shortcuts-heading");
  const capture = page.getByRole("group", { name: "Shortcut for Save item", exact: true });
  const change = capture.getByRole("button", { name: "Change Save item shortcut", exact: true });
  await expect(change).toBeEnabled();
  await change.click();
  const dialog = page.getByRole("dialog", { name: "Change Save item shortcut", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Current shortcut", { exact: true })).toBeVisible();
  await expect(dialog.locator("kbd")).toHaveText("Alt/Option+K");
  const recorder = dialog.getByRole("textbox", { name: "New shortcut for Save item", exact: true });
  await expect(recorder).toBeFocused();
  await recorder.press("j");
  await expect(recorder).toHaveValue("J");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Confirm shortcut", exact: true })).toBeEnabled();
  await recorder.press("Alt+g");
  await expect(recorder).toHaveValue("Alt/Option+G");
  await expect(dialog.getByRole("alert")).toContainText("already assigned");
  await expect(dialog.getByRole("button", { name: "Confirm shortcut", exact: true })).toBeDisabled();
  await page.keyboard.down("Alt");
  await expect(recorder).toHaveValue("Alt/Option");
  await page.keyboard.up("Alt");
  await expect(recorder).toHaveValue("Alt/Option+G");
  await recorder.press("Alt+j");
  await expect(recorder).toHaveValue("Alt/Option+J");
  await expect(dialog.locator("kbd")).toHaveText("Alt/Option+K");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await recorder.press("Escape");
  await expect(change).toBeFocused();
  await expect(capture.locator("kbd")).toHaveText("Alt/Option+K");
  await change.click();
  await recorder.press("Alt+j");
  await page.screenshot({ path: testInfo.outputPath("shortcut-recording-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await recorder.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("shortcut-recording-mobile.png") });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox(); expect(bounds!.width).toBeLessThanOrEqual(390);
  await dialog.getByRole("button", { name: "Confirm shortcut", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(capture.locator("kbd")).toHaveText("Alt/Option+J");
  await expect(page.getByRole("status").filter({ hasText: "Save item shortcut saved." })).toBeVisible();
  await page.reload();
  await expect(capture.locator("kbd")).toHaveText("Alt/Option+J");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Save first item" })).toBeVisible();
  await page.keyboard.press("Alt+k"); await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("Alt+j"); await expect(page.getByRole("dialog", { name: "Save to Keepall" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Search", exact: true }).focus();
  await page.keyboard.press("Alt+j");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.type("draft"); await expect(page.getByRole("searchbox", { name: "Search", exact: true })).toHaveValue("draft");
});

test("single keys, Ctrl, Shift and function keys can be recorded and used without Alt", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [keys, label] of [["s", "S"], ["Control+Shift+y", "Ctrl+Shift+Y"], ["Shift+j", "Shift+J"], ["F8", "F8"]]) {
    await page.goto("/settings#keyboard-shortcuts-heading");
    await page.getByRole("button", { name: "Change Save item shortcut", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Change Save item shortcut", exact: true });
    const recorder = dialog.getByRole("textbox", { name: "New shortcut for Save item", exact: true });
    await recorder.press(keys);
    await expect(recorder).toHaveValue(label);
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Confirm shortcut", exact: true }).click();
    await expect(page.getByRole("group", { name: "Shortcut for Save item", exact: true }).locator("kbd")).toHaveText(label);
    await page.goto("/");
    const save = page.getByRole("button", { name: "Save item", exact: true });
    await expect(save.locator("kbd")).toHaveCount(0);
    await save.focus();
    await page.keyboard.press(keys);
    await expect(page.getByRole("dialog", { name: "Save to Keepall", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).press("Enter");
    const search = page.getByRole("searchbox", { name: "Search", exact: true });
    await search.focus();
    await page.keyboard.press(keys);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

test("number-pad / and Use default select the same search shortcut", async ({ page }) => {
  await page.goto("/settings#keyboard-shortcuts-heading");
  const change = page.getByRole("button", { name: "Change Focus search shortcut", exact: true });
  await change.click();
  const dialog = page.getByRole("dialog", { name: "Change Focus search shortcut", exact: true });
  const recorder = dialog.getByRole("textbox", { name: "New shortcut for Focus search", exact: true });
  await recorder.press("NumpadDivide");
  await expect(recorder).toHaveValue("/");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await recorder.press("Control+m");
  await dialog.getByRole("button", { name: "Confirm shortcut", exact: true }).click();
  await change.click();
  await dialog.getByRole("button", { name: "Use default (/)", exact: true }).click();
  await expect(recorder).toHaveValue("/");
  await expect(dialog.locator("kbd")).toHaveText("Ctrl+M");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("group", { name: "Shortcut for Focus search", exact: true }).locator("kbd")).toHaveText("Ctrl+M");
  await change.click();
  await dialog.getByRole("button", { name: "Use default (/)", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirm shortcut", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("group", { name: "Shortcut for Focus search", exact: true }).locator("kbd")).toHaveText("/");
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Save first item", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save item", exact: true }).focus();
  await page.keyboard.press("NumpadDivide");
  await expect(page.getByRole("searchbox", { name: "Search", exact: true })).toBeFocused();
});

test("Space is the preview default and changing it replaces Space on library cards", async ({ page }) => {
  await seed(page);
  await page.goto("/?layout=list&unsorted=1");
  const card = page.locator('[data-item-id="review-0"]');
  await expect(card).toBeVisible();
  await card.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("dialog", { name: "Review item 1", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/settings#keyboard-shortcuts-heading");
  const group = page.getByRole("group", { name: "Shortcut for Preview results", exact: true });
  await expect(group.locator("kbd")).toHaveText("Space");
  await group.getByRole("button", { name: "Change Preview results shortcut", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Change Preview results shortcut", exact: true });
  await dialog.getByRole("textbox", { name: "New shortcut for Preview results", exact: true }).press("Control+Shift+p");
  await dialog.getByRole("button", { name: "Confirm shortcut", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto("/?layout=list&unsorted=1");
  await expect(card).toBeVisible();
  await card.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("Control+Shift+p");
  await expect(page.getByRole("dialog", { name: "Review item 1", exact: true })).toBeVisible();
});

test("active filters do not restrict the Unsorted review queue", async ({ page }) => {
  await seed(page);
  await page.goto("/?unsorted=1&type=image&q=missing");
  await page.getByRole("button", { name: "Review Unsorted" }).click();
  await expect(page.getByRole("dialog").getByRole("status").filter({ hasText: "Item 1 of 3" })).toContainText("0 reviewed");
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Review item 1" })).toBeVisible();
});

test("a new library offers Save, Import, and the tutorial, with empty Unsorted review disabled", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Save first item" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Import backup", exact: true })).toHaveAttribute("href", "/settings#backup-heading");
  await page.getByRole("link", { name: "Getting started", exact: true }).click();
  await expect(page).toHaveURL(/help\/getting-started/);
  await expect(page.getByRole("heading", { name: "Start your library", exact: true })).toBeVisible();
  await page.goto("/?unsorted=1");
  await expect(page.getByRole("button", { name: "Review Unsorted" })).toBeDisabled();
});

test("same-session tag and filing actions remain reversible through their exact history", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Review Unsorted" }).click();
  const dialog = page.getByRole("dialog");
  const tag = dialog.getByRole("textbox", { name: "Review tags", exact: true });
  await tag.fill("Reference"); await tag.press("Enter");
  await expect(dialog.getByRole("button", { name: "Remove tag Reference", exact: true })).toBeVisible();
  await tag.fill("Second tag"); await tag.press("Enter");
  await expect(dialog.getByRole("button", { name: "Remove tag Second tag", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Remove tag Reference", exact: true })).toBeVisible();
  await dialog.getByRole("textbox", { name: "Review collection", exact: true }).fill("Reading");
  await dialog.getByRole("textbox", { name: "Review collection", exact: true }).press("Enter");
  await dialog.getByRole("button", { name: "Apply changes", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Review item 2" })).toBeVisible();
  await dialog.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Review item 1" })).toBeVisible();
  await dialog.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await rows(page)).find(row => row.id === "review-0")?.tagIds).toEqual([]);
  await expect(dialog.getByRole("alert")).toHaveCount(0);
});
