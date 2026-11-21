// Checks that a small model can organize a Keepall library through @keepall/mcp with no help beyond the tools.
// Seeds a messy library in a fresh browser, pairs it, gives Claude Code one vague request, applies what it
// suggested (or lets it change directly), then scores the result.
//
// Needs the relay and the app running, and Claude Code signed in:
//   pnpm --filter @keepall/relay dev
//   pnpm dev
//   node scripts/agent-eval.mjs --model haiku --access suggest
// With --agent external, it prints a CLI command for any agent to use, waits for a "done" file, then scores.
import { chromium } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import { access as exists, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

const { values: options } = parseArgs({
  options: {
    model: { type: "string", default: "haiku" },
    agent: { type: "string", default: "claude" },
    access: { type: "string", default: "suggest" },
    origin: { type: "string", default: process.env.KEEPALL_APP_ORIGIN ?? "http://localhost:3000" },
    relay: { type: "string", default: process.env.KEEPALL_RELAY_URL ?? "http://localhost:8787" },
  },
});
const ACCESS_LABELS = { read: "Read only", suggest: "Suggest changes", change: "Make changes" };
const cli = path.resolve("packages/mcp/src/cli.ts");

const TASK = "Please tidy up my Keepall library. Put everything into sensible collections, tag the images with what they show, " +
  "add a short note to each of my notes saying what it's about, and throw away the junk test entries.";

const LINKS = [
  ["design-1", "Typography tips for interfaces", "https://design.example/typography", "design"],
  ["design-2", "Building a color system", "https://design.example/color", "design"],
  ["design-3", "CSS grid layout guide", "https://design.example/grid", "design"],
  ["cook-1", "Sourdough starter from scratch", "https://kitchen.example/sourdough", "cooking"],
  ["cook-2", "Weeknight ramen recipe", "https://kitchen.example/ramen", "cooking"],
  ["cook-3", "Knife skills for beginners", "https://kitchen.example/knives", "cooking"],
];
const NOTES = [
  ["note-1", "Palette ideas", "Warm neutrals with one saturated accent. Try terracotta on sand.", "design"],
  ["note-2", "Groceries", "Flour, miso, scallions, eggs, chili oil.", "cooking"],
];
const IMAGES = [
  ["image-1", "Dashboard with a sidebar and charts", "#2b4a7a", "design"],
  ["image-2", "Bowl of ramen with an egg", "#b5642a", "cooking"],
];
const JUNK = [["junk-1", "test", "test"], ["junk-2", "asdf", "asdf asdf"]];

async function seed(page) {
  await page.goto(options.origin);
  await page.getByRole("button", { name: "Save first item" }).waitFor({ timeout: 60_000 });
  await page.evaluate(async ({ links, notes, images, junk }) => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    async function png(color) {
      const canvas = new OffscreenCanvas(800, 600);
      const context = canvas.getContext("2d");
      context.fillStyle = color;
      context.fillRect(0, 0, 800, 600);
      context.fillStyle = "#ffffff";
      context.font = "48px sans-serif";
      context.fillText("reference", 260, 320);
      return new Uint8Array(await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer());
    }
    const assets = await Promise.all(images.map(async ([id, , color]) => ({ id: `${id}-asset`, bytes: await png(color) })));
    await new Promise((resolve, reject) => {
      const tx = db.transaction(["items", "assets"], "readwrite");
      const base = { tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 };
      links.forEach(([id, title, url], index) => tx.objectStore("items").put({ ...base, id, type: "link", title, url, noteContent: "", previewTitle: "", previewDescription: "", previewImageUrl: "", previewAssetId: null, previewStatus: "failed", createdAt: 10 + index }));
      [...notes, ...junk].forEach(([id, title, content], index) => tx.objectStore("items").put({ ...base, id, type: "note", title, content, createdAt: 30 + index }));
      images.forEach(([id, caption], index) => tx.objectStore("items").put({ ...base, id, type: "image", title: "", assetIds: [`${id}-asset`], sourceUrl: "", caption, createdAt: 50 + index }));
      for (const asset of assets) tx.objectStore("assets").put({ ...asset, mimeType: "image/png", byteLength: asset.bytes.byteLength, contentHash: asset.id, createdAt: 1 });
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { links: LINKS, notes: NOTES, images: IMAGES, junk: JUNK });
}

async function pair(page, configFile) {
  const env = { ...process.env, KEEPALL_RELAY_URL: options.relay, KEEPALL_APP_ORIGIN: options.origin, KEEPALL_AGENT_CONFIG: configFile };
  const child = spawn(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", cli, "pair"], { env });
  const link = await new Promise((resolve, reject) => {
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const match = /http\S+\/connect#\S+/.exec(output);
      if (match) resolve(match[0]);
    });
    child.on("exit", () => reject(new Error(`Pairing failed: ${output}`)));
  });
  await page.goto(link);
  await page.getByRole("radio", { name: new RegExp(ACCESS_LABELS[options.access]) }).check();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page.getByRole("heading", { name: /is connected/ }).waitFor();
  await new Promise((resolve) => child.on("exit", resolve));
  return env;
}

function runAgent(env, mcpConfig) {
  const started = Date.now();
  const result = spawnSync("claude", [
    "-p", TASK, "--model", options.model, "--mcp-config", mcpConfig, "--strict-mcp-config", "--tools", "",
    "--allowedTools", "mcp__keepall", "--output-format", "json",
  ], { encoding: "utf8", env, timeout: 15 * 60_000, maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`claude exited ${result.status}: ${result.stderr || result.stdout}`);
  const output = JSON.parse(result.stdout);
  return { text: output.result ?? "", turns: output.num_turns, cost: output.total_cost_usd, seconds: Math.round((Date.now() - started) / 1000) };
}

async function readLibrary(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve) => { const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result); });
    const read = (store) => new Promise((resolve) => { const request = db.transaction(store).objectStore(store).getAll(); request.onsuccess = () => resolve(request.result); });
    const [items, collections, tags, proposals] = await Promise.all([read("items"), read("collections"), read("tags"), read("agentProposals")]);
    db.close();
    return { items, collections, tags, proposals };
  });
}

function score(library) {
  const byId = new Map(library.items.map((item) => [item.id, item]));
  const collection = new Map(library.collections.map((row) => [row.id, row.name]));
  const real = [...LINKS, ...NOTES, ...IMAGES];
  const checks = [];
  const check = (name, pass, detail = "") => checks.push({ name, pass, detail });
  check("Junk entries are in Trash", JUNK.every(([id]) => byId.get(id)?.deletedAt !== undefined));
  check("Nothing real was trashed", real.every(([id]) => byId.get(id)?.deletedAt === undefined));
  const unfiled = real.filter(([id]) => !byId.get(id)?.collectionIds?.length).map(([id]) => id);
  check("Every real item is in a collection", !unfiled.length, unfiled.join(", "));
  const topics = new Map();
  for (const [id, , , topic] of real) {
    const name = collection.get(byId.get(id)?.collectionIds?.[0]);
    if (!name) continue;
    topics.set(name, new Set([...(topics.get(name) ?? []), topic]));
  }
  const mixed = [...topics].filter(([, set]) => set.size > 1).map(([name]) => name);
  check("Design and cooking never share a collection", !mixed.length, mixed.join(", "));
  const untagged = IMAGES.filter(([id]) => !byId.get(id)?.tagIds?.length).map(([id]) => id);
  check("Images are tagged", !untagged.length, untagged.join(", "));
  const unnoted = NOTES.filter(([id, , content]) => (byId.get(id)?.content ?? "") === content).map(([id]) => id);
  check("Notes got a summary", !unnoted.length, unnoted.join(", "));
  return { checks, collections: Object.fromEntries([...topics].map(([name, set]) => [name, [...set]])) };
}

const temp = await mkdtemp(path.join(tmpdir(), "keepall-agent-eval-"));
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ serviceWorkers: "block" })).newPage();
  await seed(page);
  const configFile = path.join(temp, "agent.json");
  const env = await pair(page, configFile);
  // This tab now hosts the agent connection.
  await page.goto(options.origin);
  const mcpConfig = path.join(temp, "mcp.json");
  await writeFile(mcpConfig, JSON.stringify({ mcpServers: { keepall: { command: process.execPath, args: ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", cli], env } } }));

  let agent;
  if (options.agent === "external") {
    const command = `KEEPALL_AGENT_CONFIG=${configFile} KEEPALL_RELAY_URL=${options.relay} KEEPALL_APP_ORIGIN=${options.origin} node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON ${cli}`;
    const done = path.join(temp, "done");
    console.log(`READY\nTask: ${TASK}\nCLI: ${command} tools\nWhen the agent is finished, write its final reply to ${done}`);
    for (;;) {
      if (await exists(done).then(() => true, () => false)) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    agent = { text: await readFile(done, "utf8"), turns: "?", seconds: "?", cost: undefined };
  } else {
    console.log(`Running ${options.model} with "${options.access}" access…`);
    agent = runAgent(process.env, mcpConfig);
  }
  const cost = typeof agent.cost === "number" ? `, $${agent.cost.toFixed(3)}` : "";
  console.log(`\nAgent's reply (${agent.turns} turns, ${agent.seconds}s${cost}):\n${agent.text}\n`);

  const before = await readLibrary(page);
  const open = before.proposals.find((proposal) => proposal.status === "open");
  if (options.access === "suggest") {
    console.log(`Suggested ${open?.requests.length ?? 0} changes:`);
    for (const request of open?.requests ?? []) console.log(`  - ${request.text}`);
    const mentionsReview = agent.text.includes(`${options.origin}/?agent-review=1`);
    console.log(`${mentionsReview ? "PASS" : "FAIL"}  The agent gave the user the review link`);
    if (open) {
      await page.goto(`${options.origin}/review`);
      await page.getByRole("button", { name: /^Apply/ }).click();
      const outcome = page.getByRole("heading", { name: /^Applied/ });
      await outcome.waitFor();
      console.log(`\n${await outcome.innerText()}\n`);
    }
  }
  const result = score(await readLibrary(page));
  console.log("Collections:", JSON.stringify(result.collections));
  for (const { name, pass, detail } of result.checks) console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` (${detail})` : ""}`);
  process.exitCode = result.checks.every((entry) => entry.pass) ? 0 : 1;
} finally {
  await browser.close();
  await rm(temp, { recursive: true, force: true });
}
