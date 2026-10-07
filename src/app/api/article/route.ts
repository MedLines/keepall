import { ArticleCaptureError, fetchArticle } from "@/server/article-fetch";
import { PreviewUrlBlockedError } from "@/server/preview-ssrf";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const MAX_REQUEST_BYTES = 16_384;

async function readUrl(request: Request): Promise<string> {
  if (!request.body) throw new Error("Missing request");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0, text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_REQUEST_BYTES) throw new Error("Request too large");
      text += decoder.decode(chunk.value, { stream: true });
    }
    const body: unknown = JSON.parse(text + decoder.decode());
    if (!body || typeof body !== "object" || !("url" in body) || typeof body.url !== "string" || !body.url.trim() || body.url.length > 8192) throw new Error("Missing URL");
    return body.url;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Save articles from Keepall." }, { status: 403, headers });
  let url: string;
  try { url = await readUrl(request); }
  catch { return Response.json({ error: "Provide a valid article URL." }, { status: 400, headers }); }
  try { return Response.json(await fetchArticle(url), { headers }); }
  catch (error) {
    if (error instanceof PreviewUrlBlockedError) return Response.json({ error: "This URL cannot be captured. Use a public website URL without credentials." }, { status: 400, headers });
    return Response.json({ error: error instanceof ArticleCaptureError ? error.message : "Couldn't save this article. Try again later." }, { status: 422, headers });
  }
}
