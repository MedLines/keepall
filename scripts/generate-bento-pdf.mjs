import { chromium } from '@playwright/test';
import sharp from 'sharp';

const image = await sharp(new URL('../public/marketing/reading-corner.webp', import.meta.url).pathname).resize(480, 546, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html lang="en"><head><style>
    @page { size: 600px 430px; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #282828; font-family: Arial, sans-serif; }
    section { position: relative; width: 600px; height: 430px; padding: 30px; background: #eeedea; break-after: page; overflow: hidden; }
    header { display: flex; justify-content: space-between; border-bottom: 1px solid #282828; padding-bottom: 10px; font-size: 10px; letter-spacing: 2px; }
    .columns { display: grid; grid-template-columns: 1fr 240px; gap: 24px; margin-top: 24px; }
    h1 { font-family: Georgia, serif; font-size: 51px; font-weight: 400; letter-spacing: -2px; line-height: .98; margin: 16px 0; }
    p { font-size: 12px; line-height: 1.65; margin: 0; }
    .label { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; }
    img { width: 240px; height: 273px; object-fit: cover; }
    footer { position: absolute; bottom: 22px; left: 30px; right: 30px; display: flex; justify-content: space-between; font-size: 9px; letter-spacing: 1px; }
    h2 { font: 38px/1.05 Georgia, serif; letter-spacing: -1px; margin: 26px 0 20px; }
    .entry { display: grid; grid-template-columns: 36px 1fr; gap: 14px; border-top: 1px solid #b4b4b0; padding: 13px 0; }
    .number { font: 24px Georgia, serif; color: #686865; }
    h3 { font-size: 13px; margin: 0 0 4px; }
    .quote { background: #303030; color: #eeedea; padding: 22px; font: 25px/1.25 Georgia, serif; }
  </style></head><body>
    <section><header><span>SUNDAY STUDIO</span><span>FIELD NOTES / NO. 01</span></header>
      <div class="columns"><div><span class="label">A small guide to slowing down</span><h1>A little<br>room<br>to think.</h1><p>Find a patch of afternoon light.<br>Pull up a chair. Open a book.<br>Let one good idea lead to another.</p></div><img src="data:image/jpeg;base64,${image.toString('base64')}" alt="A sunlit reading chair" /></div>
      <footer><span>THE WEEKEND READING SERIES</span><span>01 / 02</span></footer>
    </section>
    <section><header><span>SUNDAY STUDIO</span><span>FIELD NOTES / NO. 01</span></header><h2>Leave the afternoon open.</h2>
      <div class="columns" style="margin-top:0"><div>
        <div class="entry"><span class="number">01</span><div><h3>Start with the room</h3><p>A chair by the window. A little daylight. Somewhere you can stay a while.</p></div></div>
        <div class="entry"><span class="number">02</span><div><h3>Keep a pencil nearby</h3><p>Write down a sentence worth returning to. Follow the thought, not the clock.</p></div></div>
      </div><div><div class="quote">You don’t need to finish the book to find something worth keeping.</div><p style="margin-top:18px">Save a page. Make a note.<br>Come back whenever you like.</p></div></div>
      <footer><span>THE WEEKEND READING SERIES</span><span>02 / 02</span></footer>
    </section>
  </body></html>`);
  await page.pdf({ path: new URL('../public/marketing/demos/field-notes.pdf', import.meta.url).pathname, preferCSSPageSize: true, printBackground: true });
} finally {
  await browser.close();
}
