import { cp, mkdir, readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const runtime = dirname(require.resolve("tesseract.js/package.json"));
const core = dirname(createRequire(join(runtime, "package.json")).resolve("tesseract.js-core/package.json"));
const data = dirname(require.resolve("@tesseract.js-data/eng/package.json"));
const { version } = JSON.parse(await readFile(join(runtime, "package.json"), "utf8"));
const destination = join(process.cwd(), "public", "ocr", version);
await mkdir(destination, { recursive: true });
for (const file of ["worker.min.js", "tesseract.min.js"]) await cp(join(runtime, "dist", file), join(destination, file));
// LSTM-only builds cover normal, SIMD, and relaxed SIMD devices.
for (const file of await readdir(core)) {
  if (file.includes("lstm.wasm")) await cp(join(core, file), join(destination, file));
}
await cp(join(data, "4.0.0_best_int", "eng.traineddata.gz"), join(destination, "eng.traineddata.gz"));
await cp(join(runtime, "LICENSE.md"), join(destination, "LICENSE-tesseract.md"));
await cp(join(core, "LICENSE"), join(destination, "LICENSE-core"));
await cp(join(process.cwd(), "scripts", "ocr-worker.js"), join(destination, "recognize.js"));
