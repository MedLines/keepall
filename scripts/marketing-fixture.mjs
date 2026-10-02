import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { svgToSrgb } from "../src/color-format.mjs";

// Seed only the disposable browser passed by a marketing capture script.
export async function seedMarketingLibrary(page) {
  const output = new URL("../public/marketing/", import.meta.url);
  const assets = await Promise.all([
    "architecture.webp", "reading-corner.webp", "workflow-canvas.svg",
    "type-study.svg", "editorial-page.svg", "color-atlas.svg",
    "studio-interface.svg", "night-product.svg", "signal-landing.svg",
  ].map(async (name, index) => ({
    id: `sample-asset-${index}`,
    data: (await sharp(name.endsWith(".svg")
      ? Buffer.from(svgToSrgb(await readFile(new URL(name, output), "utf8")))
      : new URL(name, output).pathname).png().toBuffer()).toString("base64"),
  })));
  await page.evaluate(async (assets) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction(["items", "assets", "collections", "tags"], "readwrite");
      const createdAt = new Date("2026-09-01T12:00:00Z").getTime();
      for (const [id, name, color] of [["design", "Design Inspiration", "lime"], ["spaces", "Quiet spaces", "blue"], ["weekend", "Weekend projects", "pink"]]) {
        tx.objectStore("collections").put({ id, name, color, createdAt, pinnedItemIds: [] });
      }
      for (const name of ["inspiration", "someday", "favorites"]) tx.objectStore("tags").put({ id: name, name, createdAt });
      for (const asset of assets) {
        const bytes = Uint8Array.from(atob(asset.data), c => c.charCodeAt(0));
        tx.objectStore("assets").put({ id: asset.id, bytes, mimeType: "image/png", byteLength: bytes.length, contentHash: asset.id, createdAt });
      }
      const base = { updatedAt: createdAt, tagIds: ["inspiration"], caption: "", sourceUrl: "" };
      const order = [2, 0, 3, 1, 7, 4, 6, 5, 8];
      order.forEach((assetIndex, index) => tx.objectStore("items").put({ ...base, id: `design-${index}`, type: "image", title: "", assetIds: [assets[assetIndex].id], collectionIds: ["design"], createdAt: createdAt - index * 1000 }));
      [1, 0, 4].forEach((assetIndex, index) => tx.objectStore("items").put({ ...base, id: `space-${index}`, type: "image", title: ["A little room to think", "Afternoon light", "Space to breathe"][index], caption: "Quiet spaces for another day.", assetIds: [assets[assetIndex].id], collectionIds: ["spaces"], createdAt: createdAt - (index + 10) * 1000 }));
      tx.objectStore("items").put({ ...base, id: "sample-note", type: "note", title: "A slower Sunday", content: "A few quiet spaces to return to.\n\nMake room for good books, afternoon light, and a little time to think.", collectionIds: ["weekend"], createdAt: createdAt - 14000 });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  }, assets);

}
