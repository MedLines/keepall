import { expect, test, type Page } from "@playwright/test";

async function openCaptureFromShortcut(page: Page) {
  await expect(
    page.getByRole("button", { name: "Save item", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Alt+k");
  await expect(
    page.getByRole("dialog", { name: "Save to Keepall" }),
  ).toBeVisible();
}

test("Save item and Alt+K open the capture flow from the side", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const main = page.locator("main");
  const mainBefore = (await main.boundingBox())!;

  await page.getByRole("button", { name: "Save item", exact: true }).click();
  const capture = page.getByRole("dialog", { name: "Save to Keepall" });
  await expect(capture).toBeVisible();
  await expect.poll(async () => {
    const box = await capture.boundingBox();
    return box ? Math.round(box.x + box.width) : null;
  }).toBe(1440);
  expect((await capture.boundingBox())!.height).toBe(900);
  expect(await main.boundingBox()).toMatchObject({
    x: mainBefore.x,
    width: mainBefore.width,
  });
  const collectionField = capture.getByRole("textbox", { name: "Collection" });
  const tagsField = capture.getByRole("textbox", { name: "Tags" });
  expect((await collectionField.boundingBox())!.y).toBeLessThan((await tagsField.boundingBox())!.y);
  await page.screenshot({ path: testInfo.outputPath("capture-drawer.png") });
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(capture).toBeHidden();

  await openCaptureFromShortcut(page);
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await openCaptureFromShortcut(page);
  await expect.poll(async () => {
    const box = await capture.boundingBox();
    return box ? Math.round(box.x + box.width) : null;
  }).toBe(390);
  await expect.poll(async () => {
    const box = await capture.boundingBox();
    return box ? Math.round(box.x) : null;
  }).toBe(0);
});

test("large organization lists keep capture compact and actions visible", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 560 });
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
        for (let index = 1; index <= 8; index += 1) {
          tx.objectStore("collections").put({
            id: `c${index}`,
            name: `Collection ${index}`,
            createdAt: index,
            pinnedItemIds: [],
          });
          tx.objectStore("tags").put({
            id: `t${index}`,
            name: `Tag ${index}`,
            createdAt: index,
          });
        }
        for (let index = 1; index <= 2; index += 1) {
          tx.objectStore("items").put({
            id: `popular-${index}`,
            type: "note",
            title: "",
            content: `Popular item ${index}`,
            collectionIds: ["c8"],
            tagIds: ["t8"],
            createdAt: index * 10,
            updatedAt: index * 10,
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

  await openCaptureFromShortcut(page);
  const capture = page.getByRole("dialog", { name: "Save to Keepall" });
  const collections = capture.getByRole("list", { name: "Collections" });
  const tags = capture.getByRole("list", { name: "Existing tags" });
  await expect(collections.getByRole("button")).toHaveCount(7);
  await expect(tags.getByRole("button")).toHaveCount(6);
  for (const suggestions of [collections, tags]) {
    const rows = await suggestions.locator("li").evaluateAll((chips) =>
      new Set(chips.map((chip) => chip.getBoundingClientRect().top)).size,
    );
    expect(rows).toBeLessThanOrEqual(2);
  }
  await expect(collections.getByRole("button", { name: "Collection 8" })).toBeVisible();
  await expect(capture.getByRole("button", { name: "Save" })).toBeInViewport();
  await expect(capture.getByRole("button", { name: "Cancel" })).toBeInViewport();

  const scrollBox = await capture.getByTestId("capture-scroll-region").boundingBox();
  const footerBox = await capture.getByTestId("capture-footer").boundingBox();
  expect(scrollBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect(Math.round(scrollBox!.y + scrollBox!.height)).toBeLessThanOrEqual(
    Math.round(footerBox!.y),
  );
  expect(Math.round(footerBox!.y + footerBox!.height)).toBeLessThanOrEqual(560);

  await capture.getByRole("button", { name: "Browse all collections" }).click();
  const chooser = page.getByRole("dialog", { name: "Choose a collection" });
  await chooser.getByRole("searchbox", { name: "Search collections" }).fill("Collection 7");
  await chooser.getByRole("button", { name: "Collection 7" }).click();
  await expect(chooser).toBeHidden();
  await expect(
    collections.getByRole("button", { name: "Collection 7" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(collections.getByRole("button").nth(0)).toHaveText("Collection 7");
  await expect(collections.getByRole("button").nth(1)).toHaveText("Unsorted");
});

test("checking Markdown does not move collection or tag controls", async ({ page }) => {
  for (const { width, height, text } of [
    { width: 1897, height: 917, text: "# Card idea" },
    { width: 320, height: 768, text: "# Card idea" },
    { width: 320, height: 768, text: "https://example.com/article" },
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await openCaptureFromShortcut(page);
    const capture = page.getByRole("dialog", { name: "Save to Keepall" });
    await capture.getByLabel("Link, note, or image").fill(text);
    const markdown = capture.getByRole("checkbox", { name: "Markdown" });
    const positions = () => capture.evaluate((drawer) => {
      const region = drawer.querySelector('[data-testid="capture-scroll-region"]')!;
      const collection = drawer.querySelector('#capture-add-collection')!;
      const tags = drawer.querySelector('#capture-add-tag')!;
      const y = (element: Element) => Math.round(element.getBoundingClientRect().top - region.getBoundingClientRect().top + region.scrollTop);
      return { collection: y(collection), tags: y(tags) };
    });
    const before = await positions();
    await expect(capture.getByRole("button", { name: "Preview" })).toHaveCount(0);
    await markdown.check();
    await expect(capture.getByRole("button", { name: "Preview" })).toBeVisible();
    expect(await positions()).toEqual(before);
    await markdown.uncheck();
    await expect(capture.getByRole("button", { name: "Preview" })).toHaveCount(0);
    expect(await positions()).toEqual(before);
    await capture.getByRole("button", { name: "Cancel" }).click();
  }
});

test("saving a note with Alt+K survives a reload", async ({ page }) => {
  await page.goto("/");
  await openCaptureFromShortcut(page);

  await page.getByLabel("Link, note, or image").fill("Soft side light, hard rim.");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("dialog").getByText("Saved.")).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Soft side light, hard rim.", exact: true }),
  ).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Soft side light, hard rim.", exact: true }),
  ).toBeVisible();
});

test("a Markdown note keeps its source and formatting after offline reload", async ({ page, context }) => {
  await page.goto("/");
  await openCaptureFromShortcut(page);

  const capture = page.getByRole("dialog", { name: "Save to Keepall" });
  const source = "# Card idea\n\n- [x] Check spacing\n\n```tsx\nconst gap = 8;\n```";
  await capture.getByLabel("Link, note, or image").fill(source);
  await capture.getByRole("checkbox", { name: "Markdown" }).check();
  await capture.getByRole("button", { name: "Preview" }).click();
  await expect(capture.getByRole("heading", { name: "Card idea" })).toBeVisible();
  await capture.getByRole("button", { name: "Save", exact: true }).click();

  await page.reload();
  await page.getByRole("link", { name: /Card idea.*Read note/ }).click();
  await expect(page).toHaveURL(/\/items\//);
  await expect(page.getByRole("heading", { level: 1, name: "Card idea" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Completed checklist item" })).toBeDisabled();
  await expect(page.getByText("const gap = 8;")).toBeVisible();

  await expect.poll(() => page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    return Boolean(navigator.serviceWorker.controller);
  }), { timeout: 20_000 }).toBe(true);
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Card idea" })).toBeVisible();
});

test("a long note scrolls to the end on its own page", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 });
  await page.goto("/");
  await openCaptureFromShortcut(page);
  const paragraphs = Array.from({ length: 40 }, (_, index) => `Paragraph ${index}: an observation about the interface.`);
  await page.getByLabel("Link, note, or image").fill(`# Long note\n\n${paragraphs.join("\n\n")}`);
  await page.getByRole("checkbox", { name: "Markdown" }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("link", { name: /Long note.*Read note/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Long note" })).toBeVisible();

  const scrollRegion = page.locator(".ui-scrollbar").first();
  await expect.poll(() => scrollRegion.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await scrollRegion.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(page.getByText(paragraphs.at(-1)!)).toBeInViewport();
});

test("saving a link with Alt+K survives a reload", async ({ page }) => {
  await page.goto("/");
  await openCaptureFromShortcut(page);

  await page.getByLabel("Link, note, or image").fill("https://example.com/path");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(
    page.getByRole("heading", { name: "example.com" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "example.com", exact: true }),
  ).toHaveAttribute("href", "https://example.com/path");

  await page.reload();

  await expect(
    page.getByRole("link", { name: "example.com", exact: true }),
  ).toHaveAttribute("href", "https://example.com/path");
});

test("a link card opens the website while its note opens a Keepall page", async ({ page }, testInfo) => {
  await page.goto("/");
  await openCaptureFromShortcut(page);
  const capture = page.getByRole("dialog", { name: "Save to Keepall" });
  await capture.getByLabel("Link, note, or image").fill("https://example.com/design-reference");
  await capture.getByLabel("Your note (optional)").fill("## Try this layout\n\nKeep the image wide.");
  await capture.getByRole("checkbox", { name: "Markdown" }).check();
  await capture.getByRole("button", { name: "Save", exact: true }).click();

  const card = page.locator(".library-card").first();
  await expect(card.getByRole("link", { name: /Read my note/ })).toBeVisible();
  await expect(card.locator(".library-card-media a")).toHaveAttribute("href", "https://example.com/design-reference");
  await card.getByRole("link", { name: /Read my note/ }).click();
  await expect(page).toHaveURL(/\/items\//);
  await expect(page.getByRole("heading", { name: "Try this layout" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open website/ })).toHaveAttribute("href", "https://example.com/design-reference");
  await page.screenshot({ path: testInfo.outputPath("link-note-page.png"), fullPage: true });

  await page.reload();
  await expect(page.getByRole("heading", { name: "Try this layout" })).toBeVisible();
  await page.getByRole("link", { name: "Back to library" }).click();
  await page.getByRole("button", { name: "List view", exact: true }).click();
  const row = page.locator(".library-list-row").first();
  await expect(row.getByRole("link", { name: /Open example.com/ }).first()).toHaveAttribute("href", "https://example.com/design-reference");
  await expect(row.getByRole("link", { name: /Read my note/ })).toHaveAttribute("href", /\/items\//);
  await row.getByRole("link", { name: /Read my note/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Try this layout" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("heading", { name: "My note" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("link-note-page-mobile.png") });
});

test("Markdown preview is optional, bounded, and keeps the drawer width stable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 560 });
  await page.goto("/");
  await openCaptureFromShortcut(page);

  const capture = page.getByRole("dialog", { name: "Save to Keepall" });
  await capture.getByLabel("Link, note, or image").fill("https://example.com/layout");
  const note = capture.getByRole("textbox", { name: "Your note (optional)" });
  await capture.getByRole("checkbox", { name: "Markdown" }).check();
  await note.fill(Array.from({ length: 20 }, (_, index) => `## Section ${index + 1}\n\nNotes about this page.`).join("\n\n"));
  const before = await note.boundingBox();
  const preview = capture.getByLabel("Personal note preview");
  const scrollRegion = capture.getByTestId("capture-scroll-region");
  const beforeContentHeight = await scrollRegion.evaluate((element) => element.scrollHeight);
  await expect(preview).toHaveCount(0);
  await capture.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(preview).toBeVisible();
  await expect(note).toHaveCount(0);
  const after = await preview.boundingBox();
  const scroll = await scrollRegion.evaluate((element) => ({
    gutter: getComputedStyle(element).scrollbarGutter,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(scroll.gutter).toBe("stable");
  expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
  expect(scroll.scrollHeight).toBeLessThanOrEqual(beforeContentHeight + 1);
  expect(after!.height).toBeLessThanOrEqual(160);
  expect(Math.round(after!.x)).toBe(Math.round(before!.x));
  expect(after!.width).toBeCloseTo(before!.width, 2);
  await capture.getByRole("button", { name: "Hide preview" }).click();
  await expect(preview).toHaveCount(0);
  await expect(note).toBeVisible();
});

test("Cancel closes the capture dialog", async ({ page }) => {
  await page.goto("/");
  await openCaptureFromShortcut(page);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("deleting a note after confirm survives a reload", async ({ page }) => {
  await page.goto("/");
  await openCaptureFromShortcut(page);
  await page.getByLabel("Link, note, or image").fill("Remove this note.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("heading", { name: "Remove this note.", exact: true }),
  ).toBeVisible();

  const removable = page.locator(".library-card").filter({ hasText: "Remove this note." });
  await removable.hover();
  await removable.locator("summary").click();
  await removable.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();

  await expect(
    page.getByRole("heading", { name: "Remove this note.", exact: true }),
  ).toBeHidden();
  await expect(page.getByText("No items yet.")).toBeVisible();

  await page.reload();

  await expect(page.getByText("No items yet.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Remove this note.", exact: true }),
  ).toBeHidden();
});

test("editing a note survives a reload", async ({ page }) => {
  await page.goto("/");
  await openCaptureFromShortcut(page);
  await page.getByLabel("Link, note, or image").fill("Original note body.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("heading", { name: "Original note body.", exact: true }),
  ).toBeVisible();

  const editableNote = page.locator(".library-card").filter({ hasText: "Original note body." });
  await editableNote.hover();
  await editableNote.locator("summary").click();
  await editableNote.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Note content").fill("Edited note body.");
  await page.getByRole("button", { name: "Save note" }).click();

  await expect(
    page.getByRole("heading", { name: "Edited note body.", exact: true }),
  ).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Edited note body.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Original note body.", exact: true }),
  ).toBeHidden();
});

test("editing a link URL survives a reload", async ({ page }) => {
  await page.goto("/");
  await openCaptureFromShortcut(page);
  await page.getByLabel("Link, note, or image").fill("https://example.com/old");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("link", { name: "example.com", exact: true }),
  ).toHaveAttribute("href", "https://example.com/old");

  const editableLink = page.locator(".library-card").filter({ hasText: "example.com" });
  await editableLink.hover();
  await editableLink.locator("summary").click();
  await editableLink.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("URL").fill("https://example.com/new");
  await page.getByRole("button", { name: "Save link" }).click();

  await expect(
    page.getByRole("link", { name: "example.com", exact: true }),
  ).toHaveAttribute("href", "https://example.com/new");

  await page.reload();

  await expect(
    page.getByRole("link", { name: "example.com", exact: true }),
  ).toHaveAttribute("href", "https://example.com/new");
  await expect(
    page.locator('a[href="https://example.com/old"]'),
  ).toHaveCount(0);
});

test("Ctrl+Enter saves a note from the textarea", async ({ page }) => {
  await page.goto("/");
  await openCaptureFromShortcut(page);
  await page.getByLabel("Link, note, or image").fill("From keyboard shortcut");
  await page.getByLabel("Link, note, or image").press("Control+Enter");

  await expect(
    page.getByRole("heading", { name: "From keyboard shortcut", exact: true }),
  ).toBeVisible();
});
