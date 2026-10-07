import { chromium, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { seedMarketingLibrary } from "./marketing-fixture.mjs";

const origin = process.argv[2] ?? "http://localhost:3001";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw new Error("Record only a local Keepall server.");
const selectedClips = process.argv[3]?.split(",");
if (selectedClips?.some(name => !["library-demo", "collections-demo", "search-demo", "tags-demo"].includes(name))) throw new Error("Unknown marketing clip.");
const output = new URL("../public/marketing/", import.meta.url).pathname;
const scratch = await mkdtemp(join(tmpdir(), "keepall-recording-"));
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 860 }, colorScheme: "dark", serviceWorkers: "block", recordVideo: { dir: scratch, size: { width: 1440, height: 860 } } });
  await context.addInitScript(() => localStorage.setItem("keepall.storage-status-dismissed", "true"));
  await context.route("https://www.google.com/s2/favicons**", route => route.abort());
  const setup = await context.newPage();
  await setup.goto(origin);
  await setup.locator("#library-heading").waitFor();
  await setup.waitForFunction(async () => (await indexedDB.databases()).some(database => database.name === "keepall"));
  await seedMarketingLibrary(setup);
  await setup.close();
  const started = Date.now();
  const page = await context.newPage();
  const video = page.video();
  await page.goto(origin);
  await page.locator(".library-card").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "nextjs-portal, [data-agentation-root], [data-interface-kit], #interface-kit-root { display:none !important; }" });
  await page.waitForFunction(() => [...document.querySelectorAll('main img')].every(image => image.complete));
  await page.evaluate(() => {
    const pointer = document.createElement("div");
    pointer.id = "recording-pointer";
    pointer.setAttribute("aria-hidden", "true");
    pointer.style.cssText = "position:fixed;left:720px;top:700px;z-index:2147483647;pointer-events:none;width:20px;height:24px;filter:drop-shadow(0 1px 2px oklch(0 0 0 / 0.533333333))";
    pointer.innerHTML = '<svg viewBox="0 0 20 24"><path d="M2 2v18l5-5 4 7 3-2-4-7h7Z" fill="oklch(1 0 0)" stroke="oklch(0.245204495 0.007523708 285.83183319)" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.body.append(pointer);
    addEventListener("pointermove", event => { pointer.style.left = `${event.clientX}px`; pointer.style.top = `${event.clientY}px`; });
  });
  const clips = [];
  const rest = ms => page.waitForTimeout(ms);
  async function click(locator, options) {
    const box = await locator.boundingBox();
    if (!box) throw new Error("Recording target is missing.");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
    await rest(220);
    await locator.click(options);
    await rest(1100);
  }
  async function record(name, actions) {
    if (selectedClips && !selectedClips.includes(name)) return;
    await rest(700);
    const start = (Date.now() - started) / 1000;
    await rest(700);
    await actions();
    await rest(1500);
    clips.push({ name, start, duration: (Date.now() - started) / 1000 - start });
  }
  const sidebar = page.getByRole("complementary", { name: "Sidebar" });
  await record("library-demo", async () => {
    await click(page.getByRole("button", { name: "List view", exact: true }));
    await click(page.getByRole("button", { name: "Grid view", exact: true }));
  });
  await record("collections-demo", async () => {
    await click(sidebar.getByRole("button", { name: "Design Inspiration", exact: true }));
    await expect(page.locator("#library-heading")).toHaveText("Design Inspiration");
    await expect(page.locator(".library-card")).toHaveCount(9);
    await click(sidebar.getByRole("button", { name: "Quiet spaces", exact: true }));
    await expect(page.locator(".library-card")).toHaveCount(3);
  });
  await click(sidebar.getByRole("button", { name: "All items", exact: true }));
  await record("search-demo", async () => {
    const search = page.getByRole("searchbox");
    await click(search);
    await search.pressSequentially("quiet spaces", { delay: 110 });
    await expect(page.locator(".library-card")).toHaveCount(4);
    await rest(1400);
  });
  await page.getByRole("searchbox").fill("");
  await record("tags-demo", async () => {
    await click(page.locator(".library-card").first(), { button: "right" });
    await click(page.getByRole("menuitem", { name: "Tags", exact: true }));
    const favorite = page.getByRole("menuitemcheckbox", { name: "favorites", exact: true });
    if (await favorite.getAttribute("aria-checked") === "true") await favorite.click();
    await favorite.click();
    await expect(favorite).toHaveAttribute("aria-checked", "true");
    await click(page.locator("#library-heading"));
    await click(sidebar.getByRole("button", { name: "Tag favorites", exact: true }));
    await expect(page.locator(".library-card")).toHaveCount(1);
    await page.screenshot({ path: join(scratch, "tags-poster.png") });
  });
  await page.close();
  await context.close();
  const raw = await video.path();
  await writeFile(join(scratch, "clips.json"), JSON.stringify({ raw, clips }, null, 2));
  for (const clip of clips) {
    const common = ["-y", "-ss", String(clip.start), "-i", raw, "-t", String(clip.duration), "-an", "-vf", "fps=30", "-threads", "2"];
    execFileSync("ffmpeg", [...common, "-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0", "-deadline", "good", "-cpu-used", "4", join(output, `${clip.name}.webm`)], { stdio: "ignore" });
    execFileSync("ffmpeg", [...common, "-c:v", "libx264", "-crf", "22", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(output, `${clip.name}.mp4`)], { stdio: "ignore" });
    console.log(`${clip.name}: ${clip.duration.toFixed(1)}s`);
  }
  if (clips.some(clip => clip.name === "tags-demo")) execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", join(scratch, "tags-poster.png"), join(output, "app-tags.webp")]);
  console.log(`Raw capture and timing: ${scratch}`);
} finally {
  await browser.close();
}
