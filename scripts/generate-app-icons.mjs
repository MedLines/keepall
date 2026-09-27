import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Use the same cropped brand mark as the browser favicon.
const source = await readFile(new URL("../src/app/icon.svg", import.meta.url));
const logo = await sharp(source, { density: 1152 }).trim().png().toBuffer();

async function writeIcon(path, size, scale, background) {
  const mark = await sharp(logo)
    .resize(Math.round(size * scale), Math.round(size * scale), { fit: "inside" })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toFile(fileURLToPath(new URL(path, import.meta.url)));
}

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
await writeIcon("../public/icons/icon-192.png", 192, 0.9, transparent);
await writeIcon("../public/icons/icon-512.png", 512, 0.9, transparent);
// Extra space keeps the mark clear of launcher masks and rounded corners.
await writeIcon("../public/icons/icon-maskable-512.png", 512, 0.64, "#18181b");
await writeIcon("../src/app/apple-icon.png", 180, 0.76, "#18181b");
