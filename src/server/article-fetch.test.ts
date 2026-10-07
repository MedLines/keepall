import { expect, test, vi } from "vitest";
import { extractArticleHtml, fetchArticle, ArticleCaptureError, MAX_ARTICLE_HTML_BYTES } from "./article-fetch";
import { PreviewUrlBlockedError } from "./preview-ssrf";

const paragraphs = Array.from({ length: 6 }, (_, i) => `<p>Section ${i}: Narwhals travel through Arctic waters, and scientists study their migration routes. This detailed report explains the evidence, the fieldwork, and why these observations matter for their habitat.</p>`).join("");
const html = `<html><head><title>Ocean reporting</title><meta name="author" content="Ada Writer"></head><body><nav>Home Subscribe Account</nav><article><h1>Ocean reporting</h1>${paragraphs}<script>globalThis.articleScriptRan = true</script><img src="http://localhost/private" onerror="alert(1)"></article><footer>All rights reserved</footer></body></html>`;
const assertUrl = vi.fn(async (url: string) => new URL(url));

test("extracts actual article paragraphs and author without navigation, HTML or scripts", () => {
  const result = extractArticleHtml(html, "https://example.com/report", 100);
  expect(result).toMatchObject({ title: "Ocean reporting", author: "Ada Writer", sourceUrl: "https://example.com/report", capturedAt: 100 });
  expect(result.text).toContain("Section 0:");
  expect(result.text).toContain("Section 5:");
  expect(result.text).toContain("\n\n");
  expect(result.text).not.toContain("Subscribe");
  expect(result.text).not.toContain("articleScriptRan");
  expect(result.text).not.toContain("<img");
  expect(globalThis).not.toHaveProperty("articleScriptRan");
});

test("a login or empty page fails instead of saving pretend article content", () => {
  expect(() => extractArticleHtml("<html><title>Login</title><body><form>Sign in to continue</form></body></html>", "https://example.com")).toThrow(ArticleCaptureError);
});

test("uses an article heading rather than the HTML title's site prefix", () => {
  const prefixed = html.replace("<title>Ocean reporting</title>", "<title>Journal style: Ocean reporting.</title>");
  expect(extractArticleHtml(prefixed, "https://example.com/report").title).toBe("Ocean reporting");
});

test("does not mistake a site's banner heading for the article title", () => {
  const banner = html.replace("<body>", "<body><header><h1>Example Journal</h1></header>").replace("<h1>Ocean reporting</h1>", "<h2>Ocean reporting</h2>");
  expect(extractArticleHtml(banner, "https://example.com/report").title).toBe("Ocean reporting");
});

test("preserves semantic headings, nested lists, quotes, code, links and publication metadata", () => {
  const structured = html.replace("</head>", '<meta property="og:site_name" content="Ocean Journal"><meta property="article:published_time" content="2026-09-30T12:00:00Z"></head>')
    .replace(paragraphs, `${paragraphs}<h2>Migration evidence</h2><p>A <strong>careful</strong> <em>study</em> uses <a href="/references">references</a>.</p><ol start="3"><li>Observe routes<ul><li>Winter waters</li></ul></li><li>Review data</li></ol><blockquote><p>Keep the evidence.</p></blockquote><pre><code>const route = "Arctic";\n  observe(route);</code></pre>`);
  const result = extractArticleHtml(structured, "https://example.com/report", 100);
  expect(result).toMatchObject({ siteName: "Ocean Journal", publishedAt: "2026-09-30T12:00:00Z" });
  expect(JSON.stringify(result.content)).toContain('"tag":"h2"');
  expect(JSON.stringify(result.content)).toContain('"tag":"ol"');
  expect(JSON.stringify(result.content)).toContain('"start":3');
  expect(JSON.stringify(result.content)).toContain('"tag":"blockquote"');
  expect(JSON.stringify(result.content)).toContain('"tag":"pre"');
  expect(JSON.stringify(result.content)).toContain('"href":"https://example.com/references"');
  expect(result.text).toContain("Migration evidence\n\n");
});

test("keeps long legacy table-and-line-break essays even when the readerability heuristic rejects them", () => {
  const legacy = `<html><head><title>Owning the work</title></head><body><table><tr><td>${paragraphs.replaceAll("<p>", "").replaceAll("</p>", "<br><br>")}</td></tr></table></body></html>`;
  const result = extractArticleHtml(legacy, "https://example.com/essay");
  expect(result.text).toContain("Section 5:");
  expect(JSON.stringify(result.content)).not.toMatch(/"tag":"(?:tbody|tr|td)"/);
});

test("discards executable tags, event handlers, hostile URLs, and remote images from structured output", () => {
  const malicious = html.replace(paragraphs, `${paragraphs}<p onclick="alert(1)">Safe <a href="javascript:alert(1)">bad link</a><a href="https://user:secret@example.com/">credentials</a></p><iframe src="https://tracker.test"></iframe><svg><script>alert(2)</script></svg><style>body{display:none}</style>`);
  const result = extractArticleHtml(malicious, "https://example.com/report");
  const output = JSON.stringify(result.content);
  expect(output).toContain("bad link");
  expect(output).not.toMatch(/javascript:|onclick|iframe|<script|tracker.test|user:secret|localhost/);
});

test("checks each redirect destination and captures the final source URL", async () => {
  const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/final" } })).mockResolvedValueOnce(new Response(html, { headers: { "content-type": "text/html" } }));
  const allowed = vi.fn(async (url: string) => new URL(url));
  const result = await fetchArticle("https://example.com/start", { fetchImpl, assertUrl: allowed });
  expect(allowed.mock.calls.map(([url]) => url)).toEqual(["https://example.com/start", "https://example.com/final"]);
  expect(result.sourceUrl).toBe("https://example.com/final");
  expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: "manual", cache: "no-store" });
});

test("blocked redirects never reach the private upstream", async () => {
  const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/secret" } }));
  const allowed = vi.fn().mockResolvedValueOnce(new URL("https://example.com")).mockRejectedValueOnce(new PreviewUrlBlockedError("Blocked"));
  await expect(fetchArticle("https://example.com", { fetchImpl, assertUrl: allowed })).rejects.toThrow(PreviewUrlBlockedError);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test("rejects non-HTML and oversized responses rather than saving partial articles", async () => {
  await expect(fetchArticle("https://example.com", { assertUrl, fetchImpl: vi.fn().mockResolvedValue(new Response("%PDF", { headers: { "content-type": "application/pdf" } })) })).rejects.toThrow(/HTML/);
  await expect(fetchArticle("https://example.com", { assertUrl, fetchImpl: vi.fn().mockResolvedValue(new Response("x".repeat(MAX_ARTICLE_HTML_BYTES + 1), { headers: { "content-type": "text/html" } })) })).rejects.toThrow(/large/);
});

test("one timeout bounds slow requests across the entire capture", async () => {
  vi.useFakeTimers();
  try {
    const fetchImpl = vi.fn((_url, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(new Error("Abort")), { once: true });
    }));
    const result = expect(fetchArticle("https://example.com", { fetchImpl, assertUrl })).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
  } finally { vi.useRealTimers(); }
});
