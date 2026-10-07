import { expect, test, type Page } from "@playwright/test";
import { pdfFixture } from "../test-support/pdf-fixture";

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route(/https:\/\/.*example\.com|https:\/\/www\.google\.com/, route => route.abort());
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.evaluate(async pdf => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const canvas = document.createElement("canvas"); canvas.width = 600; canvas.height = 1800;
    const context = canvas.getContext("2d")!; context.fillStyle = "#c4a477"; context.fillRect(0, 0, 600, 1800);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), "image/png"));
    const imageBytes = new Uint8Array(await blob.arrayBuffer());
    const tx = db.transaction(["items", "assets", "documentAssets"], "readwrite");
    tx.objectStore("assets").put({ id: "image-asset", bytes: imageBytes, mimeType: "image/png", byteLength: blob.size, contentHash: "image", createdAt: 1 });
    const common = { tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 };
    const md = "# A calmer library\n\nMake saved ideas easy to recognize.\n\n## Before shipping\n\n- Check the narrow layout\n- Keep controls in place\n\n```css\n.preview { overflow: hidden; }\n```\n\n[Source](https://example.com)\n![Untrusted image](https://example.com/tracker.png)";
    const docs = [
      { id: "md", title: "Design checklist", sourceFileName: "design-checklist.md", format: "markdown", bytes: new TextEncoder().encode(md) },
      { id: "txt", title: "Field notes", sourceFileName: "field-notes.txt", format: "text", bytes: new TextEncoder().encode("A few things worth remembering\n\nThe library should be easy to scan.\nText belongs beside images and links.\nKeep each interaction predictable.") },
      { id: "pdf", title: "Reading guide", sourceFileName: "reading-guide.pdf", format: "pdf", bytes: new Uint8Array(pdf.portrait), pdfText: "First chapter\nA guide to a calmer library.\n\nSecond chapter" },
      { id: "pdf-wide", title: "Landscape guide", sourceFileName: "landscape-guide.pdf", format: "pdf", bytes: new Uint8Array(pdf.landscape) },
      { id: "pdf-square", title: "Square guide", sourceFileName: "square-guide.pdf", format: "pdf", bytes: new Uint8Array(pdf.square) },
    ];
    for (const doc of docs) {
      const assetId = `asset-${doc.id}`;
      tx.objectStore("documentAssets").put({ id: assetId, bytes: doc.bytes, byteLength: doc.bytes.length, contentHash: assetId, createdAt: 1, pdfText: doc.pdfText });
      tx.objectStore("items").put({ ...common, id: doc.id, type: "document", assetId, title: doc.title, sourceFileName: doc.sourceFileName, format: doc.format, noteContent: "" });
    }
    tx.objectStore("items").put({ ...common, id: "note", type: "note", title: "Ideas for the weekend", format: "markdown", content: "A place to collect small ideas.\n\n- Read something new\n- Go for a walk\n- Write down what stood out" });
    tx.objectStore("items").put({ ...common, id: "link", type: "link", url: "https://example.com/article", title: "A useful article", previewTitle: "", previewDescription: "A thoughtful approach to designing a personal library.", previewStatus: "ready", previewRetry: "none", previewAssetId: null, noteContent: "Try the quieter layout in the next iteration.", noteFormat: "plain" });
    tx.objectStore("items").put({ ...common, id: "image", type: "image", title: "Visual reference", assetIds: ["image-asset"], sourceUrl: "", caption: "" });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
  }, {
    portrait: Array.from(pdfFixture(["First chapter", "Second chapter"])),
    landscape: Array.from(pdfFixture(["Landscape page"], [{ width: 960, height: 540 }])),
    square: Array.from(pdfFixture(["Square page"], [{ width: 600, height: 600 }])),
  });
  await page.reload();
});

test("PDF covers preserve portrait, landscape, and square page proportions", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [id, ratio] of [["pdf", 612 / 792], ["pdf-wide", 16 / 9], ["pdf-square", 1]] as const) {
    const card = page.locator(`[data-item-id="${id}"]`);
    await card.scrollIntoViewIfNeeded();
    const image = card.locator("img");
    await expect(image).toBeVisible();
    await expect.poll(async () => {
      const box = (await image.boundingBox())!;
      return Math.abs(box.width / box.height - ratio);
    }).toBeLessThan(0.01);
    const cover = (await card.locator(".media-squircle-inset").boundingBox())!;
    expect(Math.abs(cover.height - (await image.boundingBox())!.height)).toBeLessThan(1);
  }
});

async function previewItem(page: Page, id: string) {
  const card = page.locator(`[data-item-id="${id}"]`);
  await card.focus();
  await card.press("Space");
  return page.getByRole("dialog");
}

async function expectReadableBadges(page: Page) {
  const ratios = await page.locator(".library-item-type-badge").evaluateAll(nodes => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    function luminance(color: string) {
      // White is the worst-case page/image behind the shared translucent dark badge.
      context.fillStyle = "white"; context.fillRect(0, 0, 1, 1);
      context.fillStyle = color; context.fillRect(0, 0, 1, 1);
      const rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    }
    return nodes.map(node => {
      const foreground = luminance(getComputedStyle(node.querySelector("svg")!).color);
      const background = luminance(getComputedStyle(node).backgroundColor);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
  });
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(3);
}

test("document cards show bounded reading previews and explicit local note actions", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const md = page.locator('[data-item-id="md"]');
  await expect(md.locator(".library-text-preview")).toContainText("Check the narrow layout");
  await expect(md.getByRole("link", { name: "Open Design checklist" })).toHaveAttribute("href", /\/items\/md/);
  await expect(md.locator(".library-text-preview a, .library-text-preview img")).toHaveCount(0);
  await expect(page.locator('[data-item-id="txt"] .library-text-preview')).toContainText("A few things worth remembering");
  await expect(page.locator('[data-item-id="pdf"]').getByRole("img", { name: "First page of Reading guide" })).toBeVisible();
  const pdfCard = page.locator('[data-item-id="pdf"]');
  await expect(pdfCard.locator(".library-card-media").getByLabel("PDF document")).toBeVisible();
  await expect(pdfCard.getByRole("img", { name: "PDF document", exact: true })).toHaveText("");
  for (const [id, label] of [["pdf", "PDF document"], ["md", "Markdown document"], ["txt", "Text document"], ["note", "Markdown note"], ["link", "Link"], ["image", "Image"]]) {
    const card = page.locator(`[data-item-id="${id}"]`);
    const badge = card.getByRole("img", { name: label, exact: true });
    await expect(badge).toBeVisible();
    await expect(badge.locator("svg")).toHaveCount(1);
    expect((await badge.locator("svg").boundingBox())!.width).toBe(16);
    expect((await badge.boundingBox())!.height).toBe(32);
    await expect(badge).toHaveCSS("border-radius", "12px");
    const placement = await badge.evaluate(node => {
      const box = node.getBoundingClientRect();
      const parent = node.closest(".library-card-media")!.getBoundingClientRect();
      return { bottom: parent.bottom - box.bottom, right: parent.right - box.right };
    });
    expect(placement.bottom).toBeCloseTo(22, 0);
    expect(placement.right).toBeCloseTo(22, 0);
    const cardBox = (await card.locator(".library-card").boundingBox())!;
    const badgeBox = (await badge.boundingBox())!;
    expect(cardBox.x + cardBox.width - badgeBox.x - badgeBox.width).toBeCloseTo(22, 0);
  }
  await expect(pdfCard.getByRole("link", { name: "Open Reading guide" })).toHaveAttribute("href", /\/items\/pdf/);
  const pdfCover = (await pdfCard.locator(".library-card-media").boundingBox())!;
  const pdfTitle = (await pdfCard.getByRole("heading", { name: "Reading guide" }).boundingBox())!;
  expect(pdfTitle.y).toBeGreaterThan(pdfCover.y + pdfCover.height);
  await expect(page.locator('[data-item-id="link"]')).toContainText("Try the quieter layout");
  await expect(page.getByText(/Read my note|Read note →|Add a note/)).toHaveCount(0);
  await expect(page.locator("[data-item-id] canvas")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("library-reading-cards-light.png") });
  await expectReadableBadges(page);
  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  await expectReadableBadges(page);
  await page.screenshot({ path: testInfo.outputPath("library-reading-cards-dark.png") });
  const preview = await previewItem(page, "md");
  await expect(preview.getByRole("heading", { name: "Before shipping" })).toBeVisible();
  await expect(preview.getByText("design-checklist.md", { exact: false })).toHaveCount(1);
  await preview.screenshot({ path: testInfo.outputPath("markdown-preview-dark.png") });
  await preview.getByRole("button", { name: "Close preview" }).click();
  await page.getByRole("button", { name: "List view", exact: true }).click();
  await expect(page.locator('[data-item-id="pdf"] .library-list-thumbnail img')).toBeVisible();
  await expect(page.locator('[data-item-id="link"]').getByRole("link", { name: "Open notes for A useful article" })).toHaveAttribute("href", /\/items\/link/);
});

for (const width of [1440, 768, 320]) {
  test(`image and PDF display controls stay in the same toolbar at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const close = page.getByRole("button", { name: "Close navigation", exact: true });
    if (await close.isVisible()) await close.click();
    const image = await previewItem(page, "image");
    const imageMode = image.getByRole("group", { name: "Image sizing" });
    await expect(imageMode.getByRole("button")).toHaveText(["Fit", "Scroll"]);
    const first = (await imageMode.boundingBox())!;
    await image.getByRole("button", { name: "Scroll image" }).click();
    await expect(image.getByRole("button", { name: "Scroll image" })).toHaveAttribute("aria-pressed", "true");
    const imageSurface = image.getByRole("region", { name: "Image viewport" });
    expect((await imageSurface.boundingBox())!.y).toBeGreaterThan(first.y + first.height);
    await image.screenshot({ path: testInfo.outputPath(`image-controls-${width}.png`) });
    await image.getByRole("button", { name: "Close preview" }).click();
    const pdf = await previewItem(page, "pdf");
    await expect(pdf.getByRole("img", { name: "PDF page 1", exact: true })).toBeVisible();
    await expect(pdf.getByRole("group", { name: "PDF view" }).getByRole("button")).toHaveText(["Pages", "Scroll"]);
    const second = (await pdf.getByRole("group", { name: "PDF view" }).boundingBox())!;
    expect(Math.abs(second.x - first.x)).toBeLessThan(1);
    expect(Math.abs(second.y - first.y)).toBeLessThan(1);
    const content = pdf.getByRole("region", { name: "Preview content", exact: true });
    expect(await content.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await pdf.getByRole("button", { name: "Pages", exact: true }).click();
    await pdf.getByRole("button", { name: "Next page", exact: true }).click();
    await expect(pdf.getByRole("img", { name: "PDF page 2", exact: true })).toBeVisible();
    await pdf.screenshot({ path: testInfo.outputPath(`pdf-controls-${width}.png`) });
  });
}
