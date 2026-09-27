import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, writeFile, mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { encodeExtensionDemo } from "./encode-extension-demo.mjs";
import { seedMarketingLibrary } from "./marketing-fixture.mjs";
import { extensionRecordingUi } from "./extension-recording-ui.mjs";

// Requires an isolated 1000×800 X11 display, ffmpeg, and xdotool.
// Browser chrome and context menus are captured from the display, not rebuilt in HTML.
const origin = process.argv[2] ?? "http://localhost:3001";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw new Error("Use a local Keepall server.");
const availableKinds = ["page", "image", "text", "organize", "undo", "notes"];
const kinds = process.argv[3] ? process.argv[3].split(",") : availableKinds;
if (kinds.some(kind => !availableKinds.includes(kind))) throw new Error(`Choose from ${availableKinds.join(", ")}.`);
const scratch = await mkdtemp(join(tmpdir(), "keepall-extension-recording-"));
const profile = join(scratch, "profile");
const extension = resolve("extension");
const output = resolve("public/marketing");
const manifest = JSON.parse(await readFile(join(extension, "manifest.json"), "utf8"));
const extensionId = createHash("sha256").update(Buffer.from(manifest.key, "base64")).digest("hex").slice(0, 32).replace(/[0-9a-f]/g, n => String.fromCharCode(97 + parseInt(n, 16)));
await mkdir(join(profile, "Default"), { recursive: true });
await writeFile(join(profile, "Default/Preferences"), JSON.stringify({ extensions: { pinned_extensions: [extensionId] }, browser: { has_seen_welcome_page: true } }));
const files = {
  "/": [resolve("scripts/marketing-capture-page.html"), "text/html"],
  "/reading-corner.webp": [join(output, "reading-corner.webp"), "image/webp"],
  "/inter.woff2": [join(extension, "inter-latin-wght-normal.woff2"), "font/woff2"],
};
const server = createServer(async (req, res) => {
  const resource = files[new URL(req.url, "http://localhost").pathname];
  if (!resource) { res.writeHead(404).end(); return; }
  try { res.writeHead(200, { "Content-Type": resource[1] }).end(await readFile(resource[0])); }
  catch { res.writeHead(500).end(); }
});
server.listen(3188, "127.0.0.1");
await once(server, "listening");
const context = await chromium.launchPersistentContext(profile, {
  headless: false, channel: "chromium", viewport: null, colorScheme: "dark",
  ignoreDefaultArgs: ["--enable-automation"],
  args: ["--ozone-platform=x11", `--disable-extensions-except=${extension}`, `--load-extension=${extension}`, "--window-size=1000,800", "--window-position=0,0", "--force-dark-mode"],
});
const rest = ms => new Promise(r => setTimeout(r, ms));
const xdo = (...args) => execFileSync(process.env.XDOTOOL ?? "xdotool", args.map(String));
async function move(x, y) {
  const position = xdo("getmouselocation", "--shell").toString();
  const startX = Number(position.match(/X=(\d+)/)[1]);
  const startY = Number(position.match(/Y=(\d+)/)[1]);
  for (let step = 1; step <= 28; step++) {
    const t = step / 28;
    const eased = t * t * (3 - 2 * t);
    xdo("mousemove", Math.round(startX + (x - startX) * eased), Math.round(startY + (y - startY) * eased));
    await rest(16);
  }
}
const screenshot = name => execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "x11grab", "-video_size", "1000x800", "-i", process.env.DISPLAY, "-frames:v", "1", join(scratch, `${name}.png`)]);
let recorder;
try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  await worker.evaluate(origin => chrome.storage.local.set({ origin, theme: "dark" }), origin);
  const page = context.pages()[0];
  // This disposable profile has its own library and sample collections.
  await page.goto(origin);
  await page.getByText("No items yet.", { exact: true }).waitFor();
  await seedMarketingLibrary(page);
  const ui = await extensionRecordingUi(context, page, move, xdo);
  await page.goto("http://localhost:3188/");
  await page.evaluate(() => document.fonts.ready);
  await page.locator("img").evaluate(img => img.decode());
  await page.locator("h1").click();
  screenshot("ready");
  console.log(`Ready: ${scratch}`);
  if (process.env.CAPTURE_PROBE) {
    await move(710, 400); xdo("click", 3); await rest(800); screenshot("image-menu");
    await rest(30000);
  } else {
    for (const kind of kinds) {
      await page.goto(`http://localhost:3188/?capture=${kind}`);
      await page.evaluate(() => document.fonts.ready);
      await rest(700);
      await move(440, 690);
      screenshot(`${kind}-poster`);
      const raw = join(scratch, `${kind}.mp4`);
      recorder = spawn("ffmpeg", ["-loglevel", "error", "-y", "-f", "x11grab", "-framerate", "30", "-video_size", "1000x800", "-probesize", "32", "-analyzeduration", "0", "-i", process.env.DISPLAY, "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency", "-crf", "16", "-progress", "pipe:1", "-stats_period", "0.05", raw], { stdio: ["pipe", "pipe", "inherit"] });
      let encodedTime = 0;
      const firstProgress = new Promise(resolve => {
        let progress = "";
        const read = chunk => {
          progress += chunk.toString();
          const lines = progress.split("\n");
          progress = lines.pop();
          for (const line of lines) {
            const time = line.match(/^out_time_us=(\d+)/);
            if (!time) continue;
            encodedTime = Number(time[1]) / 1e6;
            resolve(encodedTime);
          }
        };
        recorder.stdout.on("data", read);
      });
      const trimStart = await Promise.race([
        firstProgress,
        once(recorder, "exit").then(([code]) => { throw new Error(`Recorder stopped before the first frame: ${code}`); }),
      ]);
      // Use the video's clock so capture stalls cannot desynchronize the camera.
      const recordingTime = () => encodedTime - trimStart;
      let saveClickedAt;
      let confirmationAt;
      let editorAt;
      await rest(900);
      if (kind === "notes") {
        editorAt = recordingTime();
        xdo("key", "alt+k");
        await ui.wait("#keepall-note-input");
        await rest(700);
        await ui.click(".markdown-toggle");
        await ui.click("#keepall-note-input");
        xdo("type", "--clearmodifiers", "--delay", "45", "# A quiet corner\n\n- Warm light\n- A place to read");
        await rest(700);
        await ui.click("button[type=submit]");
        saveClickedAt = recordingTime();
        await ui.wait(".save-complete-title", "Saved to Keepall");
        confirmationAt = recordingTime();
      } else if (["page", "organize", "undo"].includes(kind)) {
        await move(850, 62);
        saveClickedAt = recordingTime();
        xdo("click", 1);
      } else {
        if (kind === "text") {
          const box = await page.locator("#passage").boundingBox();
          await move(box.x + 2, box.y + 12 + 87);
          xdo("mousedown", 1);
          await move(box.x + box.width - 2, box.y + box.height - 5 + 87);
          xdo("mouseup", 1);
          await move(box.x + 110, box.y + 12 + 87);
        } else await move(710, 400);
        xdo("click", 3);
        await rest(800);
        // Native Save to Keepall rows at the fixed 1000×800 capture size.
        await move(kind === "image" ? 824 : 297, kind === "image" ? 611 : 608);
        await rest(250);
        saveClickedAt = recordingTime();
        xdo("click", 1);
      }
      if (kind !== "notes") {
        await ui.wait(".toast-label", "saved to Keepall");
        confirmationAt = recordingTime();
      }
      if (kind === "organize") {
        await rest(650);
        await ui.click('[data-action="organize"]');
        await ui.wait(".toast-collection", "Quiet spaces");
        await rest(750);
        await ui.click(".toast-collection", "Quiet spaces");
        await ui.wait(".toast-label", "Moved to Quiet spaces");
      }
      if (kind === "undo") {
        await rest(850);
        await ui.click('[data-action="undo"]');
        await ui.wait(".toast-label", "Save undone");
      }
      await rest(kind === "notes" ? 1000 : 2300);
      recorder.stdin.write("q");
      await once(recorder, "exit");
      recorder = undefined;
      const timing = { trimStart, saveClickedAt, confirmationAt, editorAt, focusAt: Math.max(saveClickedAt, confirmationAt - .1) };
      await writeFile(join(scratch, `${kind}-timing.json`), JSON.stringify(timing, null, 2));
      encodeExtensionDemo(raw, kind, output, timing);
      execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", join(scratch, `${kind}-poster.png`), join(output, `capture-${kind}-poster.webp`)]);
      console.log(`Recorded ${kind}`);
    }
  }
} finally {
  if (recorder?.exitCode === null) {
    recorder.stdin.write("q");
    await once(recorder, "exit");
  }
  await context.close();
  server.close();
}
