import {
  assertPreviewUrlAllowed,
  PreviewUrlBlockedError,
} from "./preview-ssrf";
import { PreviewFetchError } from "./preview-fetch";

const MAX_REDIRECTS = 5;
/** Modest local preview cap. Oversize is skipped, not stored. */
export const MAX_PREVIEW_IMAGE_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8_000;

const ALLOWED_MIME_PREFIXES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
] as const;

export function isAllowedPreviewImageMime(contentType: string): boolean {
  const mime = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return ALLOWED_MIME_PREFIXES.some(
    (allowed) => mime === allowed || mime.startsWith(`${allowed}+`),
  );
}

export type PreviewImagePayload = {
  bytes: Uint8Array;
  mimeType: string;
};

export async function fetchPreviewImage(
  rawUrl: string,
  options?: {
    fetchImpl?: typeof fetch;
    assertUrl?: typeof assertPreviewUrlAllowed;
    maxBytes?: number;
  },
): Promise<PreviewImagePayload> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const assertUrl = options?.assertUrl ?? assertPreviewUrlAllowed;
  const maxBytes = options?.maxBytes ?? MAX_PREVIEW_IMAGE_BYTES;
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const allowed = await assertUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      let response: Response;
      try {
        response = await fetchImpl(allowed.toString(), {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.8",
            "User-Agent": "KeepallPreview/1.0",
          },
        });
      } catch {
        throw new PreviewFetchError("Could not fetch image");
      }

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new PreviewFetchError("Redirect missing location");
        try { current = new URL(location, allowed).toString(); }
        catch { throw new PreviewFetchError("Redirect location is invalid"); }
        continue;
      }
      if (!response.ok) throw new PreviewFetchError(`Upstream responded with ${response.status}`);

      const contentType = response.headers.get("content-type") ?? "";
      if (!isAllowedPreviewImageMime(contentType)) {
        throw new PreviewFetchError("Unsupported image type");
      }
      const mimeType = contentType.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        const declared = Number(contentLength);
        if (Number.isFinite(declared) && declared > maxBytes) {
          throw new PreviewFetchError("Image too large");
        }
      }
      if (!response.body) throw new PreviewFetchError("Empty image body");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > maxBytes) {
            await reader.cancel();
            throw new PreviewFetchError("Image too large");
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      if (length === 0) throw new PreviewFetchError("Empty image body");
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return { bytes, mimeType };
    } finally {
      clearTimeout(timer);
    }
  }

  throw new PreviewFetchError("Too many redirects");
}

export { PreviewUrlBlockedError, PreviewFetchError };
