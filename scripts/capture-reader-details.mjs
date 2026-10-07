import sharp from "sharp";
import { chromium, expect } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { seedMarketingLibrary } from "./marketing-fixture.mjs";
import { prepareCaptureContext, settleCapture, localCaptureOrigin } from "./preview-capture.mjs";

// Include the reader's full bounds and real app background, never a clipped viewport slice.
async function capturePaddedReader(page, name, locator, padding = 32) {
  await settleCapture(page);
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Missing ${name} reader.`);
  const viewport = page.viewportSize();
  if (box.x < padding || box.y < padding || box.x + box.width + padding > viewport.width || box.y + box.height + padding > viewport.height) {
    throw new Error(`${name} does not fit with ${padding}px of background. Increase the capture viewport.`);
  }
  const clip = { x: box.x - padding, y: box.y - padding, width: box.width + padding * 2, height: box.height + padding * 2 };
  const png = await page.screenshot({ clip, animations: "disabled" });
  const metadata = await sharp(png).metadata();
  await sharp(png).webp({ quality: 88 }).toFile(new URL(`../public/marketing/${name}.webp`, import.meta.url).pathname);
  console.log(`Captured ${name}: ${metadata.width} × ${metadata.height}, ${padding}px background per side`);
}

export async function captureReaderDetails(page, origin) {
  await page.setViewportSize({ width: 1760, height: 1700 });
  await page.goto(`${origin}/items/sample-pdf`);
  await page.locator('[data-pdf-ready="1"]').first().waitFor();
  await page.getByRole("button", { name: "Pages", exact: true }).click();
  await page.getByRole("combobox", { name: "PDF zoom: Fit width", exact: true }).click();
  await page.getByRole("option", { name: "100%", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "PDF zoom: 100%", exact: true })).toBeVisible();
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-pdf-ready="1"] canvas');
    return canvas && canvas.getBoundingClientRect().height < 900 && !canvas.closest('[aria-busy="true"]');
  });
  await expect(page.getByRole("img", { name: "PDF page 1", exact: true })).toBeInViewport({ ratio: 1 });
  await capturePaddedReader(page, "app-pdf-reader-detail", page.locator('article[aria-label="Document content"]'));

  await page.goto(`${origin}/items/sample-markdown`);
  await page.getByRole("heading", { name: "Make room to think", exact: true }).waitFor();
  await capturePaddedReader(page, "app-markdown-document-detail", page.locator('article[aria-label="Document content"]'));

  await page.goto(`${origin}/items/sample-article`);
  await page.locator('section[aria-label="Saved article"]').waitFor();
  await capturePaddedReader(page, "app-article-reader-detail", page.locator('section[aria-label="Saved article"]'));

  await page.goto(`${origin}/items/sample-screenshot`);
  await page.getByRole("button", { name: "Current image actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Refresh palette", exact: true }).click();
  await page.getByRole("heading", { name: "Palette", exact: true }).waitFor();
  await page.getByRole("button", { name: "Current image actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Read text again", exact: true }).click();
  await expect(page.getByRole("region", { name: "Extracted text from image 1", exact: true })).toContainText("FIELD NOTES", { timeout: 120000 });
  await expect(page.getByRole("progressbar")).toHaveCount(0, { timeout: 120000 });
  await page.getByRole("button", { name: "Scroll view", exact: true }).click();
  await page.getByRole("region", { name: "Extracted text from image 1", exact: true }).waitFor();
  await expect(page.getByRole("region", { name: "Extracted text from image 1", exact: true })).toContainText("FIELD NOTES");
  // The gallery includes its caption and counter; cropping only the results cuts those neighboring controls.
  await capturePaddedReader(page, "app-image-tools-detail", page.locator('section[aria-label="Image gallery"]'), 24);
}

// Standalone recapture leaves every other marketing/help asset unchanged.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const origin = localCaptureOrigin(process.argv[2]);
  const browser = await chromium.launch();
  try {
    const context = await prepareCaptureContext(browser);
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin);
    await page.locator("#library-heading").waitFor();
    await seedMarketingLibrary(page);
    await captureReaderDetails(page, origin);
    if (errors.length) throw new Error(errors.join("\n"));
  } finally { await browser.close(); }
}
