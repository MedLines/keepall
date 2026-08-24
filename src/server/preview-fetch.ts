import {
  assertPreviewUrlAllowed,
  PreviewUrlBlockedError,
} from "./preview-ssrf";

export type LinkPreviewPayload = {
  title: string;
  description: string;
  imageUrl: string;
};

export class PreviewFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreviewFetchError";
  }
}

const MAX_REDIRECTS = 5;
const MAX_BYTES = 1_000_000;
const FETCH_TIMEOUT_MS = 8_000;

function metaContent(html: string, property: string): string {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1].trim());
    }
  }

  return "";
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function titleTag(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : "";
}

export function parseOpenGraphHtml(html: string, pageUrl: string): LinkPreviewPayload {
  const title =
    metaContent(html, "og:title") ||
    metaContent(html, "twitter:title") ||
    titleTag(html);
  const description =
    metaContent(html, "og:description") ||
    metaContent(html, "twitter:description") ||
    metaContent(html, "description");
  const rawImage =
    metaContent(html, "og:image") || metaContent(html, "twitter:image");

  let imageUrl = "";
  if (rawImage) {
    try {
      const absolute = new URL(rawImage, pageUrl);
      if (absolute.protocol === "http:" || absolute.protocol === "https:") {
        if (!absolute.username && !absolute.password) {
          imageUrl = absolute.toString();
        }
      }
    } catch {
      imageUrl = "";
    }
  }

  return {
    title: title.slice(0, 300),
    description: description.slice(0, 500),
    imageUrl: imageUrl.slice(0, 2000),
  };
}

export async function fetchLinkPreview(
  rawUrl: string,
  options?: {
    fetchImpl?: typeof fetch;
    assertUrl?: typeof assertPreviewUrlAllowed;
  },
): Promise<LinkPreviewPayload> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const assertUrl = options?.assertUrl ?? assertPreviewUrlAllowed;
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const allowed = await assertUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetchImpl(allowed.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "User-Agent": "KeepallPreview/1.0",
        },
      });
    } catch {
      throw new PreviewFetchError("Could not fetch URL");
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        throw new PreviewFetchError("Redirect missing location");
      }
      try {
        current = new URL(location, allowed).toString();
      } catch {
        throw new PreviewFetchError("Redirect location is invalid");
      }
      continue;
    }

    if (!response.ok) {
      throw new PreviewFetchError(`Upstream responded with ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml")
    ) {
      throw new PreviewFetchError("Unsupported content type");
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      throw new PreviewFetchError("Response too large");
    }

    const html = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    return parseOpenGraphHtml(html, allowed.toString());
  }

  throw new PreviewFetchError("Too many redirects");
}

export { PreviewUrlBlockedError };
