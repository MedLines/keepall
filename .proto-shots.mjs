import { chromium } from "@playwright/test";
const out = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && errs.push(m.text()));
await p.goto("http://127.0.0.1:8765/docs/prototypes/sidebar/index.html"); await p.waitForTimeout(700);
const shot = async n => { await p.waitForTimeout(400); await p.locator("#frame").screenshot({ path: `${out}/${n}.png` }); };
const log = (...a) => console.log(...a);
log("tabs:", await p.locator(".tab b").allTextContents());
// F
await p.click('[data-proto="F"]'); await p.click('[data-fly="collections"]'); await shot("n-f-collections");
await p.click('[data-ftab="tags"]'); await p.keyboard.type("ty"); await shot("n-f-tags");
await p.click('[data-ftab="collections"]'); await p.click('[data-ftab="tags"]'); log("F tag query kept:", await p.inputValue('[data-focus="f"]'));
await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); log("F closed:", await p.locator(".flyout").count() === 0);
// G
await p.click('[data-proto="G"]'); await p.click('[data-fly="tags"]'); await shot("n-g-open");
await p.keyboard.type("an"); await shot("n-g-search");
await p.locator('[data-card="0"]').dragTo(p.locator('.flyout .row[data-id="c2"]'), { force: true }).catch(e => log("G drag err", e.message.slice(0, 80)));
log("G notice:", await p.locator(".notice").textContent().catch(() => "none"));
// H
await p.click('[data-proto="H"]'); await shot("n-h-library");
await p.click('[data-hsec="tags"]'); await shot("n-h-tags");
await p.click('[data-hsec="collections"]'); await shot("n-h-collections");
await p.click('[data-hsec="collections"]'); await shot("n-h-closed");
await p.click('[data-hsec="library"]');
// I
await p.click('[data-proto="I"]'); await shot("n-i-sidebar");
await p.keyboard.press("Control+k"); await p.keyboard.type("ty"); await shot("n-i-palette");
await p.keyboard.press("ArrowDown"); await p.keyboard.press("Tab"); await shot("n-i-filter");
log("I filter:", await p.locator('[data-pfilter][aria-pressed=true]').getAttribute("data-pfilter"));
await p.keyboard.press("Enter"); await p.waitForTimeout(200);
log("I went to:", await p.locator(".topbar h2").textContent(), "palette closed:", await p.locator(".palette").count() === 0);
await p.click('[data-pal="tags"]'); await shot("n-i-tags");
log("errors:", JSON.stringify(errs));
await b.close();
