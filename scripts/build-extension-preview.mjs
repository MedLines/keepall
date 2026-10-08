import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
// Next's pinned webpack bundle avoids adding a second build tool. Verify this
// entry point when upgrading Next; extension builds must not contain eval.
const { webpack } = require("next/dist/compiled/webpack/webpack");
const { minify, loadBindings } = require("next/dist/build/swc");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = await mkdtemp(path.join(tmpdir(), "keepall-preview-"));
const check = process.argv.includes("--check");
try {
  const stats = await new Promise((resolve, reject) => {
    const compiler = webpack({
      mode: "production", target: "web", devtool: false, context: root,
      entry: "./src/extension/note-preview.js",
      output: { path: temporary, filename: "note-preview.js" },
      optimization: { minimize: false, moduleIds: "deterministic", chunkIds: "deterministic" },
    });
    compiler.run((error, stats) => compiler.close(closeError => {
      if (error || closeError) reject(error || closeError);
      else if (stats.hasErrors()) reject(new Error(stats.toString({ all: false, errors: true })));
      else resolve(stats);
    }));
  });
  const modules = [...stats.compilation.modules];
  const packages = new Map();
  const pending = [...modules];
  while (pending.length) {
    const module = pending.pop();
    if (module.modules) pending.push(...module.modules);
    if (!module.resource?.includes("node_modules")) continue;
    let directory = path.dirname(module.resource);
    while (directory !== path.dirname(directory)) {
      try {
        const info = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
        if (info.name && info.version) packages.set(`${info.name}@${info.version}`, directory);
        break;
      } catch { directory = path.dirname(directory); }
    }
  }
  const licenses = [];
  for (const [name, directory] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
    let license;
    for (const filename of ["LICENSE", "license", "LICENSE.md", "license.md", "LICENSE-MIT", "LICENSE.txt"]) {
      try { license = await readFile(path.join(directory, filename), "utf8"); break; } catch {}
    }
    if (!license) throw new Error(`Missing license for ${name}`);
    licenses.push(`${name}\n${license.trim()}`);
  }
  await loadBindings();
  const outputs = {
    "note-preview.js": (await minify(await readFile(path.join(temporary, "note-preview.js"), "utf8"), { compress: true, mangle: true, module: "unknown", output: { comments: false } })).code,
    "note-preview.LICENSE.txt": licenses.join("\n\n--------------------\n\n") + "\n",
  };
  outputs["note-preview.js"] = "/*! Third-party licenses: note-preview.LICENSE.txt */\n" + outputs["note-preview.js"];
  if (/\beval\s*\(|new Function\s*\(/.test(outputs["note-preview.js"])) throw new Error("Preview bundle contains dynamic code evaluation.");
  await mkdir(path.join(root, "extension"), { recursive: true });
  for (const [filename, content] of Object.entries(outputs)) {
    const target = path.join(root, "extension", filename);
    if (check) {
      if (await readFile(target, "utf8") !== content) throw new Error(`${filename} is stale. Run pnpm build:extension.`);
    } else await writeFile(target, content);
  }
  console.log(`Extension preview ${check ? "verified" : "built"} (${Object.keys(outputs).join(", ")}).`);
} finally { await rm(temporary, { recursive: true, force: true }); }
