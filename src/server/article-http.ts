import { lookup } from "node:dns/promises";
import { request as httpRequest, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import { isBlockedIpAddress, parsePreviewCandidateUrl, PreviewUrlBlockedError } from "./preview-ssrf";

export async function resolveArticleAddress(raw: string, resolveDns: typeof lookup = lookup) {
  const url = parsePreviewCandidateUrl(raw);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const family = isIP(hostname);
  const addresses = family ? [{ address: hostname, family }] : await resolveDns(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isBlockedIpAddress(address))) {
    throw new PreviewUrlBlockedError("URL host resolves to a blocked address");
  }
  return { url, address: addresses[0]! };
}

/** Pin the socket's lookup to an approved address; DNS cannot change between validation and connect. */
export async function fetchPublicArticlePage(raw: string, signal: AbortSignal): Promise<Response> {
  let abort: (() => void) | undefined;
  const resolved = await Promise.race([
    resolveArticleAddress(raw),
    new Promise<never>((_, reject) => {
      abort = () => reject(signal.reason);
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    }),
  ]).finally(() => { if (abort) signal.removeEventListener("abort", abort); });
  const { url, address } = resolved;
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const options: RequestOptions & { autoSelectFamily: boolean } = {
      method: "GET", signal, agent: false, autoSelectFamily: false,
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      headers: { Accept: "text/html,application/xhtml+xml", "Accept-Encoding": "identity", "User-Agent": "KeepallReader/1.0" },
    };
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, options, response => {
      const headers = new Headers();
      for (const [key, value] of Object.entries(response.headers)) {
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
      const status = response.statusCode ?? 502;
      if ([204, 205, 304].includes(status)) { response.resume(); resolve(new Response(null, { status, headers })); }
      else resolve(new Response(Readable.toWeb(response) as ReadableStream<Uint8Array>, { status, headers }));
    });
    request.once("error", reject);
    request.end();
  });
}
