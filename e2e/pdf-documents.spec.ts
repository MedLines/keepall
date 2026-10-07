import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { pdfFixture } from "../test-support/pdf-fixture";

async function setZoom(page: Page, label: string) {
  await page.getByRole("combobox", { name: /^PDF zoom:/ }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
  await expect(page.getByRole("region", { name: "PDF viewer", exact: true }).locator('[aria-busy="true"]')).toHaveCount(0);
}

async function expectAlignedPage(canvas: Locator) {
  await expect.poll(() => canvas.evaluate(node => {
    const viewer = node.closest('[aria-label="PDF viewer"]')!;
    const toolbar = viewer.querySelector("[data-pdf-toolbar]")!;
    const surface = node.closest(".ui-scrollbar")!;
    const gap = Number.parseFloat(getComputedStyle(viewer).rowGap);
    return Math.abs(surface.getBoundingClientRect().top - toolbar.getBoundingClientRect().bottom - gap);
  })).toBeLessThan(1);
}

test.use({ serviceWorkers: "block" });

test("page navigation never clears a painted canvas that is still visible", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.keyboard.press("Alt+k");
  const drawer = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  const chooser = page.waitForEvent("filechooser");
  await drawer.getByRole("button", { name: "Add files", exact: true }).click();
  await (await chooser).setFiles({ name: "navigation.pdf", mimeType: "application/pdf", buffer: Buffer.from(pdfFixture(["First chapter", "Second chapter", "Third chapter"])) });
  await expect(drawer.getByRole("region", { name: "Selected files" })).toContainText("PDF document");
  await drawer.getByRole("button", { name: "Save", exact: true }).press("Enter");
  await expect(drawer).toBeHidden();
  const card = page.locator('[data-item-id]').first();
  await card.click({ button: "right", position: { x: 30, y: 35 } });
  await page.getByRole("menuitem", { name: "Preview", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "navigation", exact: true });
  await expect(preview.getByRole("img", { name: "PDF page 1", exact: true })).toBeVisible();
  const previewViewer = preview.getByRole("region", { name: "PDF viewer", exact: true });
  const previewScroll = preview.locator("[data-document-scroll]");
  await expect(previewViewer.locator("[data-pdf-toolbar]")).toHaveCSS("background-color", await preview.evaluate(node => getComputedStyle(node).backgroundColor));
  await previewViewer.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(previewViewer.getByRole("textbox", { name: "PDF page number", exact: true })).toHaveValue("2");
  await expectAlignedPage(previewViewer.getByRole("img", { name: "PDF page 2", exact: true }));
  expect(await previewScroll.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await previewViewer.getByRole("button", { name: "Pages", exact: true }).click();
  await previewViewer.getByRole("button", { name: "Previous page", exact: true }).click();
  const previewFirst = previewViewer.getByRole("img", { name: "PDF page 1", exact: true });
  await expect(previewFirst).toBeVisible();
  await expectAlignedPage(previewFirst);
  await preview.screenshot({ path: testInfo.outputPath("pdf-card-preview.png") });
  await preview.getByRole("button", { name: "Close preview", exact: true }).click();
  const href = await page.locator('[data-item-id] a[href^="/items/"]').first().getAttribute("href");
  await page.goto(href!);
  const viewer = page.getByRole("region", { name: "PDF viewer", exact: true });
  await expect(viewer.getByRole("group", { name: "PDF view" }).getByRole("button")).toHaveText(["Pages", "Scroll"]);
  await viewer.getByRole("button", { name: "Pages", exact: true }).click();
  const first = viewer.getByRole("img", { name: "PDF page 1", exact: true });
  await expect(first).toBeVisible();
  await expect(first.locator("../..")).toHaveAttribute("aria-busy", "false");
  await page.evaluate(() => {
    const resets: string[] = [];
    Reflect.set(window, "visiblePdfResets", resets);
    const width = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "width")!;
    Object.defineProperty(HTMLCanvasElement.prototype, "width", {
      ...width,
      set(this: HTMLCanvasElement, value: number) {
        const visible = this.isConnected && this.closest('[aria-label="PDF viewer"]') && !this.closest('[aria-hidden="true"]') && getComputedStyle(this).visibility !== "hidden";
        const before = visible ? Array.from(this.getContext("2d")!.getImageData(0, 0, 1, 1).data) : null;
        width.set!.call(this, value);
        const after = before ? this.getContext("2d")!.getImageData(0, 0, 1, 1).data : null;
        if (before?.[3] === 255 && before.some((value, index) => value !== after![index])) resets.push(this.getAttribute("aria-label")!);
      },
    });
  });
  for (const name of ["Next page", "Previous page", "Next page"]) {
    await viewer.getByRole("button", { name, exact: true }).click();
    const expected = name === "Previous page" ? 1 : 2;
    const canvas = viewer.getByRole("img", { name: `PDF page ${expected}`, exact: true });
    await expect(canvas).toBeVisible();
    await expect(canvas.locator("../..")).toHaveAttribute("aria-busy", "false");
    await expectAlignedPage(canvas);
  }
  await viewer.getByRole("button", { name: "Previous page", exact: true }).click();
  await expect(viewer.getByRole("img", { name: "PDF page 1", exact: true }).locator("../..")).toHaveAttribute("aria-busy", "false");
  await viewer.getByRole("button", { name: "Next page", exact: true }).click({ clickCount: 2, delay: 20 });
  const third = viewer.getByRole("img", { name: "PDF page 3", exact: true });
  await expect(third).toBeVisible();
  await expect(third.locator("../..")).toHaveAttribute("aria-busy", "false");
  await expect(viewer.locator(".keepall-pdf-text:visible")).toHaveText("Third chapter");
  await expectAlignedPage(third);
  expect(await page.evaluate(() => Reflect.get(window, "visiblePdfResets"))).toEqual([]);
});

test("PDF imports search all pages, render locally, edit notes, and download exact originals", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const bytes = pdfFixture(["First page", "Unicorn animation café"]);
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.keyboard.press("Alt+k");
  const drawer = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  const chooser = page.waitForEvent("filechooser");
  await drawer.getByRole("button", { name: "Add files", exact: true }).click();
  await (await chooser).setFiles({ name: "reference.pdf", mimeType: "application/pdf", buffer: Buffer.from(bytes) });
  await expect(drawer.getByRole("region", { name: "Selected files" })).toContainText("PDF document");
  await drawer.getByRole("textbox", { name: "Collection", exact: true }).fill("Reading");
  await drawer.getByRole("textbox", { name: "Collection", exact: true }).press("Enter");
  await drawer.getByRole("button", { name: "Save", exact: true }).press("Enter");
  await expect(drawer).toBeHidden();
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("UNICORN café");
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await expect(page.locator(".search-excerpt mark")).toHaveText(["Unicorn", "café"]);
  await expect(page.getByRole("img", { name: "PDF document", exact: true })).toBeVisible();
  const href = await page.locator('[data-item-id] a[href^="/items/"]').first().getAttribute("href");
  await page.goto(href!);
  const viewer = page.getByRole("region", { name: "PDF viewer", exact: true });
  await viewer.getByRole("button", { name: "Pages", exact: true }).click();
  await expect(viewer.getByText("Page 1 of 2", { exact: true })).toBeVisible();
  await expect(viewer.locator(".keepall-pdf-text:visible")).toContainText("First page");
  await viewer.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(viewer.locator(".keepall-pdf-text:visible")).toContainText("Unicorn animation café");
  const zoomTrigger = viewer.getByRole("combobox", { name: /^PDF zoom:/ });
  await zoomTrigger.click();
  const zoomMenu = page.getByRole("listbox", { name: "PDF zoom", exact: true });
  const fit = zoomMenu.getByRole("option", { name: "Fit width", exact: true });
  const zoom150 = zoomMenu.getByRole("option", { name: "150%", exact: true });
  expect(await fit.evaluate(row => {
    const popup = row.closest(".ui-popover")!.getBoundingClientRect();
    const bounds = row.getBoundingClientRect();
    return Math.abs((bounds.left - popup.left) - (popup.right - bounds.right));
  })).toBeLessThan(1);
  expect(await fit.evaluate(row => {
    const popup = getComputedStyle(row.closest(".ui-popover")!);
    const option = getComputedStyle(row);
    return {
      radiusDifference: Math.abs(Number.parseFloat(popup.borderTopLeftRadius) - Number.parseFloat(option.borderTopLeftRadius) - Number.parseFloat(popup.paddingLeft) - Number.parseFloat(popup.borderLeftWidth)),
      sameCorners: popup.getPropertyValue("corner-shape") === option.getPropertyValue("corner-shape"),
    };
  })).toEqual({ radiusDifference: 0, sameCorners: true });
  await expect(fit.locator("svg")).toHaveCount(1);
  await expect(fit).toHaveText("Fit width");
  await zoom150.hover();
  await expect(zoom150).toHaveAttribute("data-highlighted");
  await expect(fit).not.toHaveAttribute("data-highlighted");
  await expect(fit).toHaveAttribute("aria-selected", "true");
  await zoomMenu.locator("..").screenshot({ path: testInfo.outputPath("pdf-zoom-menu-light.png") });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await zoomTrigger.click();
  await zoom150.hover();
  await zoomMenu.locator("..").screenshot({ path: testInfo.outputPath("pdf-zoom-menu-dark.png") });
  await zoomMenu.press("ArrowUp");
  await expect(zoomMenu.getByRole("option", { name: "100%", exact: true })).toHaveAttribute("data-highlighted");
  await zoomMenu.press("Enter");
  await expect(zoomTrigger).toHaveAccessibleName("PDF zoom: 100%");
  await setZoom(page, "150%");
  await expect(viewer.locator(".keepall-pdf-text:visible")).toContainText("Unicorn animation café");
  await page.screenshot({ path: testInfo.outputPath("pdf-reader-desktop.png") });

  await page.getByRole("button", { name: "Edit document", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit document", exact: true });
  await expect(editor.getByRole("textbox", { name: "Text content", exact: true })).toHaveCount(0);
  await editor.getByRole("textbox", { name: "Title", exact: true }).fill("PDF reference");
  await editor.getByRole("textbox", { name: "Notes", exact: true }).fill("My personal reminder");
  await editor.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByRole("region", { name: "Personal note" })).toContainText("My personal reminder");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download file", exact: true }).click();
  const saved = await download;
  expect(saved.suggestedFilename()).toBe("reference.pdf");
  expect(Array.from(await readFile((await saved.path())!))).toEqual(Array.from(bytes));

  await page.setViewportSize({ width: 320, height: 900 });
  await setZoom(page, "Fit width");
  await expect(viewer.locator(".keepall-pdf-text:visible")).toContainText("Unicorn animation café");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("pdf-reader-mobile.png") });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/settings#storage");
  const backup = page.getByRole("region", { name: "Backup", exact: true });
  const exported = page.waitForEvent("download");
  await backup.getByRole("button", { name: "Export backup", exact: true }).click();
  const archive = (await (await exported).path())!;
  const input = backup.locator('input[accept*="application/zip"]');
  await input.setInputFiles(archive);
  const review = page.getByRole("dialog", { name: "Import backup", exact: true });
  await review.getByRole("button", { name: "Replace library", exact: true }).click();
  await page.getByRole("dialog", { name: "Replace library?", exact: true }).getByRole("button", { name: "Confirm replacement", exact: true }).click();
  await expect(page.locator('div[role="status"][aria-atomic="true"]')).toContainText("Library replaced from backup");
  await input.setInputFiles(archive);
  await review.getByRole("button", { name: "Merge", exact: true }).click();
  await expect(page.locator('div[role="status"][aria-atomic="true"]')).toContainText("Merged:");
  await page.goto("/?q=" + encodeURIComponent("Unicorn café"));
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await expect(page.locator(".search-excerpt mark")).toHaveText(["Unicorn", "café"]);
  await page.goto(href!);
  await viewer.getByRole("button", { name: "Pages", exact: true }).click();
  await expect(viewer.locator(".keepall-pdf-text:visible")).toContainText("First page");
  await expect(page.getByRole("region", { name: "Personal note" })).toContainText("My personal reminder");
  const restoredDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download file", exact: true }).click();
  expect(Array.from(await readFile((await (await restoredDownload).path())!))).toEqual(Array.from(bytes));
  expect(errors).toEqual([]);
});

test("continuous PDF reading uses the item scrollbar, bounds canvases, and preserves the current page between views", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.keyboard.press("Alt+k");
  const drawer = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  const sizes = Array.from({ length: 20 }, (_, index) => index % 2 ? { width: 792, height: 612 } : { width: 595, height: 842 });
  const chooser = page.waitForEvent("filechooser");
  await drawer.getByRole("button", { name: "Add files", exact: true }).click();
  await (await chooser).setFiles({ name: "continuous.pdf", mimeType: "application/pdf", buffer: Buffer.from(pdfFixture(Array.from({ length: 20 }, (_, index) => `Chapter ${index + 1}`), sizes)) });
  await expect(drawer.getByRole("region", { name: "Selected files" })).toContainText("continuous.pdf");
  await expect(drawer.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
  await drawer.getByRole("button", { name: "Save", exact: true }).press("Enter");
  await expect(drawer).toBeHidden();
  const href = await page.locator('[data-item-id] a[href^="/items/"]').first().getAttribute("href");
  await page.goto(href!);
  const viewer = page.getByRole("region", { name: "PDF viewer", exact: true });
  await page.setViewportSize({ width: 1897, height: 917 });
  await expect(viewer.getByRole("button", { name: "Scroll", exact: true })).toHaveAttribute("aria-pressed", "true");
  const toolbar = viewer.locator("[data-pdf-toolbar]");
  const toolbarTop = await toolbar.evaluate(node => node.getBoundingClientRect().top);
  const detailsTop = await page.getByRole("complementary", { name: "Document details", exact: true }).evaluate(node => node.getBoundingClientRect().top);
  expect(Math.abs(toolbarTop - detailsTop)).toBeLessThan(1);
  await expect(page.getByRole("heading", { name: "continuous", exact: true, level: 1 })).toHaveCount(1);
  const first = viewer.getByRole("img", { name: "PDF page 1", exact: true });
  await expect(first).toBeVisible();
  await expect(viewer.getByLabel("Continuous PDF pages").locator("p")).toHaveCount(0);
  expect(await viewer.locator("canvas").count()).toBeLessThan(8);
  await first.locator("..").hover();
  await page.mouse.wheel(0, 1600);
  await expect(viewer.getByRole("status")).not.toHaveText("Page 1 of 20");
  expect(await toolbar.evaluate(node => {
    const bounds = node.getBoundingClientRect();
    return document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top - 6)?.closest("[data-pdf-toolbar]") === node;
  })).toBe(true);
  expect(await page.getByTestId("item-page-scroll").evaluate(node => getComputedStyle(node).maskImage)).not.toBe("none");
  await expect.poll(() => toolbar.locator(".scroll-fade-overlay").evaluate(node => Number(getComputedStyle(node).opacity))).toBeGreaterThan(0);
  const current = (await viewer.getByRole("status").textContent())!;
  const number = Number(current.match(/Page (\d+)/)![1]);
  await viewer.getByRole("button", { name: "Pages", exact: true }).click();
  await expect(viewer.locator("canvas:visible")).toHaveCount(1);
  await expect(viewer.locator(".keepall-pdf-text:visible")).toHaveText(`Chapter ${number}`);
  await expectAlignedPage(viewer.locator("canvas:visible"));
  await viewer.locator("canvas:visible").locator("..").hover();
  await page.mouse.wheel(0, 400);
  await viewer.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(viewer.locator(".keepall-pdf-text:visible")).toHaveText(`Chapter ${number + 1}`);
  await expectAlignedPage(viewer.locator("canvas:visible"));
  await viewer.getByRole("button", { name: "Previous page", exact: true }).click();
  await expect(viewer.locator(".keepall-pdf-text:visible")).toHaveText(`Chapter ${number}`);
  await expectAlignedPage(viewer.locator("canvas:visible"));
  expect(await viewer.locator("canvas:visible").evaluate(canvas => {
    const page = canvas.closest("main")!.getBoundingClientRect();
    const bounds = canvas.getBoundingClientRect();
    return bounds.top >= page.top && bounds.top < page.bottom;
  })).toBe(true);
  await viewer.getByRole("button", { name: "Scroll", exact: true }).click();
  expect(Math.abs((await toolbar.evaluate(node => node.getBoundingClientRect().top)) - toolbarTop)).toBeLessThan(1);
  await expect(viewer.getByRole("status")).toHaveText(current);
  await expect(viewer.getByRole("img", { name: `PDF page ${number}`, exact: true })).toBeVisible();
  await viewer.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(viewer.getByRole("status")).toHaveText(`Page ${number + 1} of 20`);
  await setZoom(page, "150%");
  await expect(viewer.getByRole("status")).toHaveText(`Page ${number + 1} of 20`);
  await expect(viewer.getByRole("img", { name: `PDF page ${number + 1}`, exact: true })).toBeVisible();
  expect(await viewer.locator("canvas").count()).toBeLessThan(8);
  await page.screenshot({ path: testInfo.outputPath("pdf-scroll-desktop.png") });
  await page.setViewportSize({ width: 320, height: 900 });
  await setZoom(page, "Fit width");
  await expect(viewer.getByRole("img", { name: `PDF page ${number + 1}`, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("pdf-scroll-mobile.png") });
  await page.setViewportSize({ width: 1280, height: 900 });
  const pageNumber = viewer.getByRole("textbox", { name: "PDF page number", exact: true });
  await pageNumber.fill("12");
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(pageNumber).toHaveValue("12");
  await pageNumber.press("Enter");
  await expect(viewer.getByRole("status")).toHaveText("Page 12 of 20");
  for (let next = 13; next <= 17; next++) {
    await viewer.getByRole("button", { name: "Next page", exact: true }).click();
    await expect(viewer.getByRole("status")).toHaveText(`Page ${next} of 20`);
    const surface = viewer.getByRole("img", { name: `PDF page ${next}`, exact: true });
    await expect(surface).toBeVisible();
    await expectAlignedPage(surface);
    const top = await surface.evaluate(canvas => canvas.getBoundingClientRect().top);
    await expect(surface.locator("..").locator(".keepall-pdf-text")).toHaveText(`Chapter ${next}`);
    expect(Math.abs((await surface.evaluate(canvas => canvas.getBoundingClientRect().top)) - top)).toBeLessThan(2);
  }
  await viewer.getByRole("button", { name: "Next page", exact: true }).click({ clickCount: 3, delay: 35 });
  await expect(viewer.getByRole("status")).toHaveText("Page 20 of 20");
  await pageNumber.fill("999");
  await pageNumber.press("Enter");
  await expect(viewer.getByRole("status")).toHaveText("Page 20 of 20");
  await expect(viewer.getByRole("button", { name: "Next page", exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});

test("unreadable and locked PDFs leave no saved originals or organization", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.keyboard.press("Alt+k");
  const drawer = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  const chooser = page.waitForEvent("filechooser");
  await drawer.getByRole("button", { name: "Add files", exact: true }).click();
  await (await chooser).setFiles([
    { name: "broken.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nbroken\n%%EOF") },
    { name: "locked.pdf", mimeType: "application/pdf", buffer: await readFile("test-support/password-protected.pdf") },
  ]);
  await expect(drawer.getByRole("region", { name: "Selected files" })).toContainText("locked.pdf");
  await drawer.getByRole("textbox", { name: "Collection", exact: true }).fill("Unused");
  await drawer.getByRole("textbox", { name: "Tags", exact: true }).fill("Unused");
  await drawer.getByRole("button", { name: "Save", exact: true }).press("Enter");
  await expect(drawer.getByRole("region", { name: "Selected files" })).toContainText("Couldn't read this PDF");
  await expect(drawer.getByRole("region", { name: "Selected files" })).toContainText("This PDF needs a password");
  const counts = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result); });
    try {
      const names = ["items", "documentAssets", "collections", "tags"];
      const tx = db.transaction(names);
      return await Promise.all(names.map(name => new Promise<number>(resolve => { const request = tx.objectStore(name).count(); request.onsuccess = () => resolve(request.result); })));
    } finally { db.close(); }
  });
  expect(counts).toEqual([0, 0, 0, 0]);
  await drawer.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(drawer).toBeHidden();
});
