import { cp, mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const source = dirname(require.resolve("pdfjs-dist/package.json"));
const { version } = JSON.parse(await readFile(join(source, "package.json"), "utf8"));
const destination = join(process.cwd(), "public", "pdfjs", version);
await mkdir(destination, { recursive: true });
for (const folder of ["cmaps", "standard_fonts", "wasm"]) {
  await cp(join(source, folder), join(destination, folder), { recursive: true });
}
await cp(join(source, "legacy/build/pdf.worker.min.mjs"), join(destination, "pdf.worker.min.mjs"));
await cp(join(source, "LICENSE"), join(destination, "LICENSE"));
