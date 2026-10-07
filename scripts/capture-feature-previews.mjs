import { chromium, expect } from "@playwright/test";
import { captureReaderDetails } from "./capture-reader-details.mjs";
import { seedMarketingLibrary } from "./marketing-fixture.mjs";
import { prepareCaptureContext, capturePreview, localCaptureOrigin } from "./preview-capture.mjs";

// Current app UI, isolated sample files, and no personal browser profile.
const origin = localCaptureOrigin(process.argv[2]);
const browser = await chromium.launch();
try {
  const context = await prepareCaptureContext(browser);
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const browserErrors = [];
  page.on("pageerror", error => browserErrors.push(error.message));

  const capture = (name, locator = page) => capturePreview(page, new URL(`../public/marketing/${name}.webp`, import.meta.url), locator);
  await page.goto(origin);
  await page.locator("#library-heading").waitFor();
  await seedMarketingLibrary(page);
  await page.reload();
  await expect(page.locator(".library-card")).toHaveCount(20);
  await capture("app-library");
  for (const [id, name, ready] of [
    ["sample-pdf", "app-pdf-reader", () => page.locator('[data-pdf-ready="1"]').first().waitFor()],
    ["sample-markdown", "app-markdown-document", () => page.getByRole("heading", { name: "Make room to think", exact: true }).waitFor()],
    ["sample-article", "app-article-reader", () => page.locator("section[aria-label=\"Saved article\"]").waitFor()],
    ["sample-video", "app-video-detail", () => page.waitForFunction(() => document.querySelector("video")?.readyState >= 2)],
  ]) {
    await page.goto(`${origin}/items/${id}`);
    await ready();
    await capture(name);
  }
  await page.goto(`${origin}/items/sample-screenshot`);
  await page.getByRole("button", { name: "Current image actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Refresh palette", exact: true }).click();
  await page.getByRole("heading", { name: "Palette", exact: true }).waitFor();
  await page.getByRole("button", { name: "Current image actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Read text again", exact: true }).click();
  await expect(page.getByRole("region", { name: "Extracted text from image 1", exact: true })).toContainText("FIELD NOTES", { timeout: 120000 });
  await expect(page.getByRole("progressbar")).toHaveCount(0, { timeout: 120000 });
  await page.getByRole("button", { name: "Scroll view", exact: true }).click();
  await page.setViewportSize({ width: 1100, height: 1400 });
  await page.getByTestId("item-page-scroll").evaluate(node => { node.scrollTop = 0; });
  await expect(page.getByRole("heading", { name: "Palette", exact: true })).toBeInViewport();
  await expect(page.getByRole("heading", { name: "Screenshot text", exact: true })).toBeInViewport();
  await capture("app-image-tools");

  await page.setViewportSize({ width: 1440, height: 860 });
  await page.goto(origin);
  await page.getByRole("searchbox").fill("field notes");
  await expect(page.locator(".library-card")).toHaveCount(6);
  await expect(page.getByText("Searching document contents…", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retry search", exact: true })).toHaveCount(0);
  await expect(page.locator(".library-card").filter({ hasText: "Sunday studio" })).toContainText("Image text:");
  await expect(page.locator(".library-card").filter({ hasText: "sunday-field-notes.pdf" })).toContainText("File contents:");
  await capture("app-search");
  await capture("app-search-files");
  await page.setViewportSize({ width: 1000, height: 780 });
  await capture("app-search-detail", page.locator(".library-panel"));
  await page.setViewportSize({ width: 1440, height: 860 });
  await page.getByRole("searchbox").fill("");
  await page.locator('.library-card').filter({ hasText: "Weekend field notes" }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Preview", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("heading", { name: "Make room to think", exact: true }).waitFor();
  await capture("app-preview-document");
  await page.getByRole("button", { name: "Close preview", exact: true }).click();
  await page.goto(`${origin}/items/sample-rich-note`);
  await page.getByRole("button", { name: "Edit note", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit note", exact: true });
  await expect(editor.getByRole("region", { name: "Images in this note", exact: true })).toBeVisible();
  await capturePreview(page, new URL("../public/help/note-editor.webp", import.meta.url), editor);
  await captureReaderDetails(page, origin);
  if (browserErrors.length) throw new Error(browserErrors.join("\n"));
} finally { await browser.close(); }
