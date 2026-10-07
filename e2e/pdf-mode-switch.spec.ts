import { writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { pdfFixture } from "../test-support/pdf-fixture";

type ModeFrame = {
  notesTop: number;
  viewportBottom: number;
  viewerHeight: number;
  scrollTop: number;
  scrollHeight: number;
  currentPage: string;
  paintedPage: boolean;
};

async function recordModeSwitch(page: Page, mode: "Pages" | "Scroll" | "Next page", pageNumber?: number) {
  return page.evaluate(async ({ target, pageNumber }) => {
    const viewer = document.querySelector<HTMLElement>('[aria-label="PDF viewer"]')!;
    const scroll = document.querySelector<HTMLElement>("[data-document-scroll]")!;
    const notes = document.querySelector<HTMLElement>('[aria-label="Personal note"]')!;
    const measure = () => ({
      notesTop: notes.getBoundingClientRect().top,
      viewportBottom: scroll.getBoundingClientRect().bottom,
      viewerHeight: viewer.getBoundingClientRect().height,
      scrollTop: scroll.scrollTop,
      scrollHeight: scroll.scrollHeight,
      currentPage: viewer.querySelector<HTMLInputElement>('[aria-label="PDF page number"]')!.value,
      paintedPage: Array.from(viewer.querySelectorAll<HTMLCanvasElement>(pageNumber ? `canvas[aria-label="PDF page ${pageNumber}"]` : 'canvas[role="img"]')).some(canvas => {
        const bounds = canvas.getBoundingClientRect();
        return bounds.bottom > scroll.getBoundingClientRect().top && bounds.top < scroll.getBoundingClientRect().bottom && !canvas.closest('[aria-hidden="true"]') && getComputedStyle(canvas.parentElement!).opacity === "1";
      }),
    });
    const frames = [measure()];
    const button = Array.from(viewer.querySelectorAll("button")).find(node => node.textContent === target || node.getAttribute("aria-label") === target)!;
    button.click();
    // Observe every painted frame, including the first frames before PDF canvases finish rendering.
    for (let frame = 0; frame < 45; frame++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      frames.push(measure());
    }
    return frames;
  }, { target: mode, pageNumber });
}

test.use({ serviceWorkers: "block" });

for (const scenario of [
  { width: 1280, pageNumber: 2, pageCount: 3, zoom: "Fit width" },
  { width: 1280, pageNumber: 12, pageCount: 20, zoom: "150%" },
  { width: 390, pageNumber: 2, pageCount: 3, zoom: "Fit width" },
]) {
  test(`PDF mode switches preserve notes and the painted page at ${scenario.width}px, page ${scenario.pageNumber}, ${scenario.zoom}`, async ({ page }, testInfo) => {
    const { pageNumber, pageCount } = scenario;
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Save item", exact: true })).toBeVisible();
    await page.keyboard.press("Alt+k");
    const drawer = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
    const chooser = page.waitForEvent("filechooser");
    await drawer.getByRole("button", { name: "Add files", exact: true }).click();
    await (await chooser).setFiles({
      name: "mode-switch.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(pdfFixture(
        Array.from({ length: pageCount }, (_, index) => `Chapter ${index + 1}`),
        Array.from({ length: pageCount }, (_, index) => index % 2 ? { width: 595, height: 842 } : { width: 792, height: 612 }),
      )),
    });
    await expect(drawer.getByRole("region", { name: "Selected files" })).toContainText("PDF document");
    await drawer.getByRole("button", { name: "Save", exact: true }).press("Enter");
    await expect(drawer).toBeHidden();
    const href = await page.locator('[data-item-id] a[href^="/items/"]').first().getAttribute("href");
    await page.goto(href!);
    await page.setViewportSize({ width: scenario.width, height: 900 });
    const viewer = page.getByRole("region", { name: "PDF viewer", exact: true });
    await expect(viewer.getByRole("img", { name: "PDF page 1", exact: true })).toBeVisible();
    await viewer.getByRole("button", { name: "Pages", exact: true }).click();
    const counter = viewer.getByRole("textbox", { name: "PDF page number", exact: true });
    await counter.fill(String(pageNumber));
    await counter.press("Enter");
    await expect(viewer.getByRole("img", { name: `PDF page ${pageNumber}`, exact: true })).toBeVisible();
    if (scenario.zoom !== "Fit width") {
      await viewer.getByRole("combobox", { name: /^PDF zoom:/ }).click();
      await page.getByRole("option", { name: scenario.zoom, exact: true }).click();
    }
    await expect(viewer.locator('[aria-busy="true"]')).toHaveCount(0);

    for (const [index, mode] of (["Scroll", "Pages", "Scroll"] as const).entries()) {
      const name = `${index + 1}-switch-to-${mode.toLowerCase()}`;
      await page.screenshot({ path: testInfo.outputPath(`before-${name}.png`) });
      const frames: ModeFrame[] = await recordModeSwitch(page, mode, pageNumber);
      await page.screenshot({ path: testInfo.outputPath(`after-${name}.png`) });
      const framePath = testInfo.outputPath(`${name}-frames.json`);
      await writeFile(framePath, JSON.stringify(frames, null, 2));
      await testInfo.attach(`${name}-frames`, {
        path: framePath,
        contentType: "application/json",
      });
      const before = frames[0];
      const after = frames.at(-1)!;
      expect.soft(Math.min(...frames.map(frame => frame.notesTop)),
        "notes must not jump above either settled position").toBeGreaterThanOrEqual(Math.min(before.notesTop, after.notesTop) - 1);
      expect.soft(Math.min(...frames.map(frame => frame.viewerHeight)),
        "the PDF viewer must not collapse below either settled view's height").toBeGreaterThanOrEqual(Math.min(before.viewerHeight, after.viewerHeight) - 1);
      expect.soft(frames.every(frame => frame.currentPage === String(pageNumber)),
        "the current page must stay selected throughout the switch").toBe(true);
      expect.soft(frames.every(frame => frame.paintedPage),
        "the painted PDF must stay visible throughout the switch").toBe(true);
      await expect(counter).toHaveValue(String(pageNumber));
      await expect(viewer.getByRole("img", { name: `PDF page ${pageNumber}`, exact: true })).toBeVisible();
    }
    await viewer.getByRole("button", { name: "Pages", exact: true }).click();
    const navigationFrames = await recordModeSwitch(page, "Next page");
    expect(navigationFrames.every(frame => frame.paintedPage), "page navigation keeps the previous paint until the next page is ready").toBe(true);
    await expect(counter).toHaveValue(String(pageNumber + 1));
    await expect(viewer.getByRole("img", { name: `PDF page ${pageNumber + 1}`, exact: true })).toBeVisible();
    const returnFrames = await recordModeSwitch(page, "Scroll", pageNumber + 1);
    expect(returnFrames.every(frame => frame.paintedPage), "switching after page navigation preserves the new canvas").toBe(true);
    expect(returnFrames.every(frame => frame.currentPage === String(pageNumber + 1))).toBe(true);
    expect(errors).toEqual([]);
  });
}
