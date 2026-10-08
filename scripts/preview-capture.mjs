import sharp from "sharp";

export const captureViewport = { width: 1440, height: 860 };

export async function prepareCaptureContext(browser) {
  const context = await browser.newContext({ viewport: captureViewport, deviceScaleFactor: 2, colorScheme: "dark", reducedMotion: "reduce", serviceWorkers: "block" });
  await context.addInitScript(() => localStorage.setItem("keepall.storage-status-dismissed", "true"));
  await context.route("https://www.google.com/s2/favicons**", route => route.abort());
  return context;
}

export async function settleCapture(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "nextjs-portal, [data-agentation-root], [data-interface-kit], #interface-kit-root { display:none !important; }" });
  await page.waitForFunction(() => [...document.querySelectorAll('main img')].every(image => image.complete));
  await page.waitForTimeout(500);
}

export async function capturePreview(page, output, locator = page) {
  await settleCapture(page);
  if (locator !== page) await locator.scrollIntoViewIfNeeded();
  const png = await locator.screenshot({ animations: "disabled" });
  const metadata = await sharp(png).metadata();
  await sharp(png).webp({ quality: 88 }).toFile(output.pathname);
  console.log(`Captured ${output.pathname}: ${metadata.width} × ${metadata.height}`);
}

export function localCaptureOrigin(value = "http://localhost:3001") {
  if (!["localhost", "127.0.0.1"].includes(new URL(value).hostname)) throw new Error("Capture only a local Keepall server.");
  return value;
}
