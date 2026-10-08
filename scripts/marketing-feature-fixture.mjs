import sharp from "sharp";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { createWorker } from "tesseract.js";
import ts from "typescript";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export const fieldNotes = `# Weekend field notes

A small plan for a slower Sunday. Save the interesting parts now and return when there is time.

## Make room to think

- Visit the reading room before lunch.
- Take photographs of the afternoon light.
- Bring the **field notes** and a favorite book.

> Good ideas need somewhere quiet to land.

## What to bring

| Item | Why |
| --- | --- |
| Notebook | Sketch the room and collect details |
| Camera | Keep a record of the changing light |
| Book | Leave time to read |

\`\`\`text
leave the afternoon open
\`\`\`
`;

// Real local files and genuine recognition results, prepared outside the UI.
export async function marketingFeatureFixture(page) {
  const scratch = await mkdtemp(join(tmpdir(), "keepall-fixture-"));
  const assets = [];
  const asset = (id, bytes, mimeType) => {
    assets.push({ id, data: bytes.toString("base64"), mimeType });
    return id;
  };
  try {
    const screenshot = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="720"><rect width="1120" height="720" fill="#F7F3E8"/><rect width="1120" height="32" fill="#B34632"/><circle cx="985" cy="572" r="210" fill="#D6DEB8"/><g font-family="DejaVu Sans" fill="#262D25"><text x="76" y="123" font-size="23" letter-spacing="4">SUNDAY STUDIO</text><text x="76" y="224" font-size="63" font-weight="bold">Make room to think.</text><text x="76" y="306" font-size="30">A little afternoon light.</text><text x="76" y="356" font-size="30">A favorite book. A slower Sunday.</text><text x="76" y="463" font-size="27" font-weight="bold">FIELD NOTES</text><text x="76" y="520" font-size="27">Keep the details worth returning to.</text><text x="76" y="575" font-size="27">Leave the afternoon open.</text></g></svg>`)).png().toBuffer();
    asset("sample-english-screenshot", screenshot, "image/png");
    const require = createRequire(import.meta.url);
    const language = dirname(require.resolve("@tesseract.js-data/eng/package.json"));
    const worker = await createWorker("eng", 1, { langPath: join(language, "4.0.0_best_int"), cachePath: scratch, cacheMethod: "none" });
    let recognized;
    try { recognized = (await worker.recognize(screenshot)).data; } finally { await worker.terminate(); }
    if (!recognized.text.includes("FIELD NOTES")) throw new Error("Sample screenshot recognition did not find its heading.");
    const compiled = ts.transpileModule(await readFile(new URL("../src/domain/image-analysis.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    const { extractPixelPalette } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
    const pixels = await sharp(screenshot).resize({ width: 160 }).ensureAlpha().raw().toBuffer();
    const analysis = { assetId: "sample-english-screenshot", palette: extractPixelPalette(new Uint8ClampedArray(pixels)), ocr: { text: recognized.text.trim(), confidence: recognized.confidence, language: "eng", extractedAt: Date.parse("2026-09-01T12:00:00Z") } };

    const pdfPage = await page.context().newPage();
    let pdf;
    try {
      await pdfPage.setContent(`<html><head><style>@page{size:A4;margin:68px}body{font-family:Arial;color:#28332a;font-size:16px;line-height:1.75}small{letter-spacing:3px;color:#8b503f}h1{font-size:43px;line-height:1.15;margin:32px 0}h2{font-size:22px;margin-top:36px}hr{border:0;border-top:1px solid #cad2ba;margin:32px 0}.lead{font-size:21px}section+section{break-before:page}.badge{background:#e2e8d3;padding:20px 26px}</style></head><body><section><small>SUNDAY STUDIO / READING COPY</small><h1>Field notes for<br>a slower Sunday</h1><p class="lead">Keep a little space for good books, afternoon light, and the details worth returning to.</p><hr><h2>Start with the room</h2><p>Choose a quiet place by the window. Put the notebook within reach and leave the afternoon open. These field notes are a small invitation to notice what is already there.</p><h2>A few things to bring</h2><ul><li>A favorite book and a pencil.</li><li>A camera for the changing light.</li><li>A notebook for ideas that arrive slowly.</li></ul><p class="badge">Make room to think. There is no need to fill every page.</p></section><section><small>SUNDAY STUDIO / FIELD NOTES</small><h1>Leave the<br>afternoon open</h1><p>Walk through the reading room, take a few photographs, and write down the details you want to remember.</p><h2>Return to the useful parts</h2><p>Save a page, a paragraph, or a photograph. Give it a title that will make sense when you come back to it.</p></section></body></html>`);
      pdf = await pdfPage.pdf({ printBackground: true });
    } finally { await pdfPage.close(); }
    const pdfTask = getDocument({ data: new Uint8Array(pdf), useSystemFonts: true });
    const pdfDocument = await pdfTask.promise;
    const pdfPages = [];
    try {
      for (let number = 1; number <= pdfDocument.numPages; number++) {
        const text = await (await pdfDocument.getPage(number)).getTextContent();
        pdfPages.push(text.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join(""));
      }
    } finally { await pdfTask.destroy(); }
    const documents = [
      { id: "sample-pdf-original", format: "pdf", data: pdf.toString("base64"), pdfText: pdfPages.join("\n\n").trim() },
      { id: "sample-markdown-original", format: "markdown", data: Buffer.from(fieldNotes).toString("base64") },
      { id: "sample-text-original", format: "text", data: Buffer.from("Field notes\n\nReading room, Sunday afternoon\n\nBring a notebook and a favorite book. Look for the changing light by the tall window. Keep the details worth returning to.\n\nLeave the afternoon open.\n").toString("base64") },
    ];
    const videoPath = join(scratch, "afternoon-light.mp4");
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-loop", "1", "-i", new URL("../public/marketing/architecture.webp", import.meta.url).pathname, "-t", "5", "-vf", "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(zoom+0.0005,1.08)':d=125:s=1280x720:fps=25", "-threads", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", videoPath]);
    asset("sample-local-video", await readFile(videoPath), "video/mp4");
    const posterPath = join(scratch, "video-poster.webp");
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", videoPath, "-frames:v", "1", "-vf", "scale=640:-1", posterPath]);
    assets.at(-1).poster = (await readFile(posterPath)).toString("base64");
    return { assets, documents, analysis, fieldNotes };
  } finally { await rm(scratch, { recursive: true, force: true }); }
}
