import sharp from "sharp";
import { randomBytes } from "node:crypto";
import { expect, test, vi } from "vitest";
import { MAX_ARTICLE_IMAGE_BYTES, MAX_ARTICLE_IMAGES, MAX_ARTICLE_IMAGES_BYTES, type ArticleNode } from "@/domain/article";
import { captureArticleImages } from "./article-image";

function images(...sources: string[]): ArticleNode[] {
  return sources.map(src => ({ tag: "img", children: [], src, alt: "Article chart" }));
}

function options(fetchImpl: typeof fetch) {
  return { fetchImpl, signal: new AbortController().signal, deadline: Date.now() + 15_000 };
}

test("captures a real raster chart once, shrinks it, and returns a bounded static WebP", async () => {
  const source = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: "#407baa" } }).png().toBuffer();
  const url = "https://example.com/chart.png";
  const fetchImpl = vi.fn().mockResolvedValue(new Response(source, { headers: { "content-type": "image/png" } }));
  const result = await captureArticleImages(images(url, url), options(fetchImpl));
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ sourceUrl: url, mimeType: "image/webp" });
  const saved = Buffer.from(result[0].dataBase64, "base64");
  const metadata = await sharp(saved).metadata();
  expect(metadata).toMatchObject({ format: "webp", width: 1600, height: 1200 });
  expect(saved.byteLength).toBeLessThanOrEqual(1024 * 1024);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: "manual", headers: { Accept: expect.stringContaining("image/webp") } });
});

test("skips private, credentialed and non-HTTP sources before any request", async () => {
  const fetchImpl = vi.fn();
  const result = await captureArticleImages(images("http://127.0.0.1/private", "http://[::1]/private", "http://localhost/private", "https://user:secret@example.com/image", "data:image/png;base64,AAAA", "file:///tmp/private"), options(fetchImpl));
  expect(result).toEqual([]);
  expect(fetchImpl).not.toHaveBeenCalled();
});

test("rejects a redirect to a private destination and retains the original placeholder", async () => {
  const content = images("https://example.com/chart.png");
  const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest" } }));
  expect(await captureArticleImages(content, options(fetchImpl))).toEqual([]);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(content).toEqual(images("https://example.com/chart.png"));
});

test.each([
  ["image/svg+xml", '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'],
  ["image/png", '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'],
  ["text/html", "<html>Login required</html>"],
  ["image/png", "<html>Login required</html>"],
  ["image/webp", "not an image"],
])("does not decode unsupported or spoofed %s bodies", async (mime, body) => {
  const fetchImpl = vi.fn().mockResolvedValue(new Response(body, { headers: { "content-type": mime } }));
  expect(await captureArticleImages(images("https://example.com/chart"), options(fetchImpl))).toEqual([]);
});

test("enforces declared and streamed source byte limits", async () => {
  const fetchImpl = vi.fn().mockResolvedValueOnce(new Response("small body", { headers: { "content-type": "image/png", "content-length": String(MAX_ARTICLE_IMAGE_BYTES + 1) } }))
    .mockResolvedValueOnce(new Response(new Uint8Array(MAX_ARTICLE_IMAGE_BYTES + 1), { headers: { "content-type": "image/png", "content-length": "10" } }));
  expect(await captureArticleImages(images("https://example.com/declared", "https://example.com/streamed"), options(fetchImpl))).toEqual([]);
});

test("bounds the number of unique source requests", async () => {
  const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
  expect(await captureArticleImages(images(...Array.from({ length: 25 }, (_, index) => `https://example.com/chart-${index}`)), options(fetchImpl))).toEqual([]);
  expect(fetchImpl).toHaveBeenCalledTimes(MAX_ARTICLE_IMAGES);
});

test("checks each public redirect and associates stored bytes with the original source", async () => {
  const chart = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#407baa" } }).png().toBuffer();
  const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/final.png" } }))
    .mockResolvedValueOnce(new Response(chart, { headers: { "content-type": "image/png" } }));
  const assertUrl = vi.fn(async (url: string) => new URL(url));
  const result = await captureArticleImages(images("https://example.com/first.png"), { ...options(fetchImpl), assertUrl });
  expect(result[0].sourceUrl).toBe("https://example.com/first.png");
  expect(assertUrl.mock.calls.map(([url]) => url)).toEqual(["https://example.com/first.png", "https://example.com/final.png"]);
});

test("does not request images once the shared deadline has passed", async () => {
  const fetchImpl = vi.fn();
  expect(await captureArticleImages(images("https://example.com/chart.png"), { ...options(fetchImpl), deadline: Date.now() - 1 })).toEqual([]);
  expect(fetchImpl).not.toHaveBeenCalled();
});

test("rejects raster images beyond the decoded pixel cap", async () => {
  const oversized = await sharp({ create: { width: 4001, height: 4000, channels: 3, background: "#407baa" } }).png().toBuffer();
  expect(oversized.byteLength).toBeLessThan(MAX_ARTICLE_IMAGE_BYTES);
  const fetchImpl = vi.fn().mockResolvedValue(new Response(oversized, { headers: { "content-type": "image/png" } }));
  expect(await captureArticleImages(images("https://example.com/huge.png"), options(fetchImpl))).toEqual([]);
});

test("keeps aggregate decoded transport bytes within the article image budget", { timeout: 20_000 }, async () => {
  const noisy = await sharp(randomBytes(1000 * 1000 * 3), { raw: { width: 1000, height: 1000, channels: 3 } }).jpeg({ quality: 70 }).toBuffer();
  const fetchImpl = vi.fn(async () => new Response(noisy, { headers: { "content-type": "image/jpeg" } }));
  const result = await captureArticleImages(images(...Array.from({ length: 16 }, (_, index) => `https://example.com/noise-${index}.jpg`)), options(fetchImpl));
  expect(result.length).toBeGreaterThan(0);
  expect(result.length).toBeLessThan(16);
  const stored = result.map(image => Buffer.from(image.dataBase64, "base64"));
  expect(stored.every(bytes => bytes.byteLength <= 1024 * 1024)).toBe(true);
  expect(stored.reduce((total, bytes) => total + bytes.byteLength, 0)).toBeLessThanOrEqual(MAX_ARTICLE_IMAGES_BYTES);
});

test("a stalled image stream stops with the article signal and keeps earlier captured images", async () => {
  const controller = new AbortController();
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({ start(stream) { stream.enqueue(new Uint8Array([137, 80, 78, 71])); }, cancel });
  const chart = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#407baa" } }).png().toBuffer();
  const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(chart, { headers: { "content-type": "image/png" } }))
    .mockResolvedValueOnce(new Response(body, { headers: { "content-type": "image/png" } }));
  const pending = captureArticleImages(images("https://example.com/first.png", "https://example.com/slow.png"), { ...options(fetchImpl), signal: controller.signal });
  await vi.waitFor(() => expect(body.locked).toBe(true));
  controller.abort(new Error("Article deadline reached"));
  expect(await pending).toMatchObject([{ sourceUrl: "https://example.com/first.png", mimeType: "image/webp" }]);
  expect(cancel).toHaveBeenCalled();
});
