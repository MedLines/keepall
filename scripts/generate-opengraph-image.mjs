import { copyFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const [logo, font] = await Promise.all([
  readFile(join(root, "public/icons/keepall.svg")),
  readFile(join(root, "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2")),
]);

const browser = await chromium.launch();

try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`
    <style>
      @font-face {
        font-family: Inter;
        src: url(data:font/woff2;base64,${font.toString("base64")}) format("woff2");
        font-weight: 100 900;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 1200px; height: 630px; }
      .canvas {
        position: relative;
        width: 1200px;
        height: 630px;
        overflow: hidden;
        color: #f8f7f9;
        font-family: Inter, sans-serif;
        background:
          radial-gradient(ellipse 430px 390px at 26% 52%, rgba(255, 68, 112, .27), transparent 82%),
          radial-gradient(ellipse 430px 360px at 96% 2%, rgba(255, 129, 152, .075), transparent 80%),
          linear-gradient(145deg, #202025, #141417 72%);
      }
      .canvas::after {
        content: "";
        position: absolute;
        inset: 0;
        border: 1px solid rgba(255, 255, 255, .09);
        pointer-events: none;
      }
      .logo {
        position: absolute;
        left: 29px;
        top: 47px;
        width: 550px;
        height: 550px;
      }
      .copy { position: absolute; left: 568px; top: 178px; width: 565px; }
      .eyebrow {
        display: flex;
        align-items: center;
        gap: 16px;
        color: #ff9db2;
        font-size: 17px;
        font-weight: 600;
        letter-spacing: .16em;
        text-transform: uppercase;
      }
      .eyebrow::before {
        content: "";
        display: block;
        width: 43px;
        height: 3px;
        border-radius: 999px;
        background: linear-gradient(90deg, #ff577c, #ffb3c3);
      }
      h1 {
        margin: 25px 0 25px;
        font-size: 108px;
        font-weight: 580;
        line-height: 1;
        letter-spacing: -.075em;
      }
      p {
        margin: 0;
        max-width: 520px;
        color: #d4d2d7;
        font-size: 33px;
        font-weight: 380;
        line-height: 1.32;
        letter-spacing: -.028em;
      }
    </style>
    <main class="canvas">
      <img class="logo" src="data:image/svg+xml;base64,${logo.toString("base64")}" alt="" />
      <div class="copy">
        <div class="eyebrow">Local-first personal library</div>
        <h1>keepall</h1>
        <p>A home for your links and notes.</p>
      </div>
    </main>
  `);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await document.querySelector(".logo").decode();
  });
  const output = join(root, "src/app/opengraph-image.png");
  await page.locator(".canvas").screenshot({ path: output });
  await copyFile(output, join(root, "src/app/twitter-image.png"));
} finally {
  await browser.close();
}
