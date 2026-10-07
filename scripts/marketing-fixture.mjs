import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { marketingFeatureFixture } from "./marketing-feature-fixture.mjs";
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
  const features = await marketingFeatureFixture(page);
  await page.evaluate(async ({ assets, features }) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction(["items", "assets", "documentAssets", "videoAssets", "thumbnails", "collections", "tags"], "readwrite");
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
      order.forEach((assetIndex, index) => tx.objectStore("items").put({ ...base, id: `design-${index}`, type: "image", title: "", tagIds: index === 0 ? ["inspiration", "favorites"] : ["inspiration"], assetIds: [assets[assetIndex].id], collectionIds: ["design"], createdAt: createdAt - index * 1000 }));
      [1, 0, 4].forEach((assetIndex, index) => tx.objectStore("items").put({ ...base, id: `space-${index}`, type: "image", title: ["A little room to think", "Afternoon light", "Space to breathe"][index], caption: "Quiet spaces for another day.", assetIds: [assets[assetIndex].id], collectionIds: ["spaces"], createdAt: createdAt - (index + 10) * 1000 }));
      tx.objectStore("items").put({ ...base, id: "sample-note", type: "note", title: "A slower Sunday", content: "A few quiet spaces to return to.\n\nMake room for good books, afternoon light, and a little time to think.", collectionIds: ["weekend"], createdAt: createdAt - 14000 });
      for (const file of features.assets) {
        const bytes = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
        if (file.mimeType.startsWith("video/")) {
          tx.objectStore("videoAssets").put({ id: file.id, blob: new Blob([bytes], { type: file.mimeType }), mimeType: file.mimeType, byteLength: bytes.length, createdAt });
          const poster = Uint8Array.from(atob(file.poster), c => c.charCodeAt(0));
          tx.objectStore("thumbnails").put({ assetId: file.id, blob: new Blob([poster], { type: "image/webp" }) });
        } else tx.objectStore("assets").put({ id: file.id, bytes, mimeType: file.mimeType, byteLength: bytes.length, contentHash: file.id, createdAt });
      }
      for (const file of features.documents) {
        const bytes = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
        tx.objectStore("documentAssets").put({ id: file.id, bytes, byteLength: bytes.length, contentHash: file.id, createdAt, ...(file.pdfText ? { pdfText: file.pdfText } : {}) });
      }
      const mixed = { ...base, tagIds: [], collectionIds: ["weekend"] };
      tx.objectStore("items").put({ ...mixed, id: "sample-screenshot", type: "image", title: "Sunday studio", caption: "A reminder to leave the afternoon open.", assetIds: ["sample-english-screenshot"], analysis: [features.analysis], createdAt: createdAt + 6000 });
      tx.objectStore("items").put({ ...mixed, id: "sample-markdown", type: "document", title: "Weekend field notes", sourceFileName: "weekend-field-notes.md", format: "markdown", assetId: "sample-markdown-original", noteContent: "Bring this plan along next Sunday.", createdAt: createdAt + 5000 });
      tx.objectStore("items").put({ ...mixed, id: "sample-video", type: "video", title: "Afternoon light", sourceFileName: "afternoon-light.mp4", assetId: "sample-local-video", noteContent: "The reading room, saved as a local clip.", createdAt: createdAt + 4000 });
      tx.objectStore("items").put({ ...mixed, id: "sample-pdf", type: "document", title: "Field notes for a slower Sunday", sourceFileName: "sunday-field-notes.pdf", format: "pdf", assetId: "sample-pdf-original", noteContent: "A reading copy to keep for the weekend.", createdAt: createdAt + 3000 });
      tx.objectStore("items").put({ ...mixed, id: "sample-text", type: "document", title: "Reading room checklist", sourceFileName: "reading-room.txt", format: "text", assetId: "sample-text-original", noteContent: "Keep the original text file with the plan.", createdAt: createdAt + 2000 });
      const paragraph = "A quiet room changes the way an afternoon feels. With a favorite book, a pencil, and a little light, there is room to notice the details that usually pass by.";
      const article = { title: "A little room to think", sourceUrl: "https://sunday-studio.example/reading-room", capturedAt: createdAt, author: "Sunday Studio", siteName: "Sunday Studio Journal", publishedAt: "2026-08-30", text: `${paragraph} Field notes for a slower Sunday. Leave the afternoon open.`, content: [{ tag: "p", children: [{ text: paragraph }] }, { tag: "figure", children: [{ tag: "img", src: "https://sunday-studio.example/room.webp", assetId: "sample-asset-1", alt: "A reading room in afternoon light", children: [] }, { tag: "figcaption", children: [{ text: "Afternoon light in the reading room." }] }] }, { tag: "h2", children: [{ text: "Field notes for a slower Sunday" }] }, { tag: "p", children: [{ text: "Bring a notebook. Save the useful parts. Leave the afternoon open." }] }] };
      tx.objectStore("items").put({ ...mixed, id: "sample-article", type: "link", title: article.title, url: article.sourceUrl, article, noteContent: "Try the quiet corner next to the tall window.", previewStatus: "ready", previewTitle: article.title, previewDescription: paragraph, previewImageUrl: "", previewAssetId: null, previewRetry: null, previewAttemptedAt: null, createdAt: createdAt + 1000 });
      tx.objectStore("items").put({ ...mixed, id: "sample-rich-note", type: "note", title: "", format: "markdown", content: features.fieldNotes + "\n![Afternoon light](keepall-image:sample-asset-1)\n", createdAt: createdAt - 15000 });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  }, { assets, features });

}
