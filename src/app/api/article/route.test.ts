import { expect, test, vi } from "vitest";
import { POST } from "./route";
import { fetchArticle, ArticleCaptureError } from "@/server/article-fetch";
import { PreviewUrlBlockedError } from "@/server/preview-ssrf";

vi.mock("@/server/article-fetch", () => ({ fetchArticle: vi.fn(), ArticleCaptureError: class extends Error {} }));
const request = (body: string, origin?: string) => new Request("https://keepall.example/api/article", { method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { origin } : {}) }, body });

test("captures only valid bounded same-origin requests with uncached responses", async () => {
  vi.mocked(fetchArticle).mockReset();
  for (const body of ["null", "[]", '{"url":1}', "invalid", JSON.stringify({ url: "x".repeat(20_000) })]) {
    expect((await POST(request(body))).status).toBe(400);
  }
  expect((await POST(request('{"url":"https://example.com"}', "https://other.example"))).status).toBe(403);
  expect(fetchArticle).not.toHaveBeenCalled();
  const article = { title: "Title", text: "Captured", sourceUrl: "https://example.com/", capturedAt: 1 };
  vi.mocked(fetchArticle).mockResolvedValue(article);
  const response = await POST(request('{"url":"https://example.com"}', "https://keepall.example"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual(article);
});

test("blocked targets and extraction failures return useful safe errors", async () => {
  vi.mocked(fetchArticle).mockRejectedValueOnce(new PreviewUrlBlockedError("Private details"));
  const blocked = await POST(request('{"url":"http://127.0.0.1"}'));
  expect(blocked.status).toBe(400);
  expect(JSON.stringify(await blocked.json())).not.toContain("Private details");
  vi.mocked(fetchArticle).mockRejectedValueOnce(new ArticleCaptureError("This page needs a login."));
  const failed = await POST(request('{"url":"https://example.com"}'));
  expect(failed.status).toBe(422);
  expect(await failed.json()).toEqual({ error: "This page needs a login." });
});

test("uses the browser-facing host for local aliases and proxy TLS termination", async () => {
  const article = { title: "Title", text: "Captured", sourceUrl: "https://example.com/", capturedAt: 1 };
  vi.mocked(fetchArticle).mockReset().mockResolvedValue(article);
  const capture = (headers: Record<string, string>) => POST(new Request("http://0.0.0.0:3100/api/article", {
    method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: '{"url":"https://example.com"}',
  }));
  expect((await capture({ origin: "http://localhost:3100", host: "localhost:3100" })).status).toBe(200);
  expect((await capture({ origin: "https://www.keepall.app", host: "internal:3100", "x-forwarded-host": "www.keepall.app", "x-forwarded-proto": "https" })).status).toBe(200);
  expect((await capture({ origin: "https://www.keepall.app", host: "internal:3100", "x-forwarded-host": "WWW.KEEPALL.APP, internal:3100" })).status).toBe(200);
  expect(fetchArticle).toHaveBeenCalledTimes(3);
  for (const origin of ["https://other.example", "http://localhost:3101", "http://0.0.0.0:3100", "null", "invalid", "https://www.keepall.app/path", "https://user@www.keepall.app"]) {
    expect((await capture({ origin, host: "localhost:3100", "x-forwarded-host": "www.keepall.app" })).status).toBe(403);
  }
  expect(fetchArticle).toHaveBeenCalledTimes(3);
});
