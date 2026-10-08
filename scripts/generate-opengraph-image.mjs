import { copyFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const [logo, font, screenshot] = await Promise.all([
  readFile(join(root, "public/icons/keepall.svg")),
  readFile(join(root, "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2")),
  readFile(join(root, "public/marketing/app-library.webp")),
]);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(`
    <style>
      @font-face {
        font-family: Inter;
        src: url(data:font/woff2;base64,${font.toString("base64")}) format("woff2");
        font-weight: 100 900;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 1200px; height: 630px; }
      .canvas { width: 1200px; height: 630px; overflow: hidden; padding: 56px 64px 0;
        background: #101014; color: #f3eeeb; font-family: Inter, sans-serif; }
      header { display: flex; align-items: center; gap: 12px; }
      .logo { width: 44px; height: 44px; }
      .brand { font-size: 48px; font-weight: 650; letter-spacing: -2px; }
      .address { margin-left: auto; font-size: 24px; color: #cbbfc5; }
      h1 { margin: 30px 0 12px; font-size: 36px; font-weight: 450; letter-spacing: -1px; }
      p { margin: 0; color: #beb7bf; font-size: 22px; line-height: 1.5; }
      .library { display: block; width: 1072px; height: auto; margin-top: 32px;
        border: 1px solid #323236; border-radius: 16px 16px 0 0; }
    </style>
    <main class="canvas">
      <header>
        <img class="logo" src="data:image/svg+xml;base64,${logo.toString("base64")}" alt="" />
        <span class="brand">keepall</span>
        <span class="address">keepall.app</span>
      </header>
      <h1>A home for your good finds.</h1>
      <p>Links, notes, images, articles, and files. Free. No account.</p>
      <img class="library" src="data:image/webp;base64,${screenshot.toString("base64")}" alt="" />
    </main>
  `);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
  });
  const output = join(root, "src/app/opengraph-image.png");
  await page.locator(".canvas").screenshot({ path: output });
  await copyFile(output, join(root, "src/app/twitter-image.png"));
} finally {
  await browser.close();
}
