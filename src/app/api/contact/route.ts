import { getContactEmailConfig, sendContactEmail } from "@/server/contact-email";
import { parseContactInput } from "@/server/contact-input";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const MAX_REQUEST_BYTES = 32_768;

class ContactBodyTooLarge extends Error {}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") return false;
  try {
    const source = new URL(origin);
    const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host).split(",")[0].trim().toLowerCase();
    return ["http:", "https:"].includes(source.protocol) && source.origin === origin && source.host === host;
  } catch { return false; }
}

async function readContactBody(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("content-length"));
  if (length > MAX_REQUEST_BYTES) throw new ContactBodyTooLarge();
  if (!request.body) throw new Error("Missing body");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_REQUEST_BYTES) throw new ContactBodyTooLarge();
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function GET() {
  return Response.json({ available: getContactEmailConfig() !== null }, { headers });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Send your message from the Keepall contact page." }, { status: 403, headers });
  const config = getContactEmailConfig();
  if (!config) return Response.json({ error: "Email sending isn't available yet. Copy your message or report it on GitHub." }, { status: 503, headers });
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return Response.json({ error: "Send a JSON contact message." }, { status: 415, headers });
  }
  let input: unknown;
  try { input = await readContactBody(request); }
  catch (error) {
    return Response.json({ error: "Your message is invalid or too long. Check the fields and try again." }, { status: error instanceof ContactBodyTooLarge ? 413 : 400, headers });
  }
  const fields = parseContactInput(input);
  if (!fields) return Response.json({ error: "Check your name, email, topic, and message, then try again." }, { status: 400, headers });
  try {
    await sendContactEmail(fields, config);
    return Response.json({ accepted: true }, { headers });
  } catch {
    return Response.json({ error: "We couldn't confirm your message was sent. Your draft is still here. Try again later or copy it for GitHub." }, { status: 502, headers });
  }
}
