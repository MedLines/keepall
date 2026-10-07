import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class PreviewUrlBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreviewUrlBlockedError";
  }
}

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    throw new PreviewUrlBlockedError("Invalid IPv4 address");
  }
  return ((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!;
}

function isBlockedIpv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  const ranges: Array<[number, number]> = [
    [ipv4ToInt("0.0.0.0"), ipv4ToInt("0.255.255.255")],
    [ipv4ToInt("10.0.0.0"), ipv4ToInt("10.255.255.255")],
    [ipv4ToInt("100.64.0.0"), ipv4ToInt("100.127.255.255")],
    [ipv4ToInt("127.0.0.0"), ipv4ToInt("127.255.255.255")],
    [ipv4ToInt("169.254.0.0"), ipv4ToInt("169.254.255.255")],
    [ipv4ToInt("172.16.0.0"), ipv4ToInt("172.31.255.255")],
    [ipv4ToInt("192.0.0.0"), ipv4ToInt("192.0.0.255")],
    [ipv4ToInt("192.0.2.0"), ipv4ToInt("192.0.2.255")],
    [ipv4ToInt("198.51.100.0"), ipv4ToInt("198.51.100.255")],
    [ipv4ToInt("203.0.113.0"), ipv4ToInt("203.0.113.255")],
    [ipv4ToInt("192.168.0.0"), ipv4ToInt("192.168.255.255")],
    [ipv4ToInt("198.18.0.0"), ipv4ToInt("198.19.255.255")],
    [ipv4ToInt("224.0.0.0"), ipv4ToInt("255.255.255.255")],
  ];
  return ranges.some(([start, end]) => value >= start && value <= end);
}

function isBlockedIpv6(ip: string): boolean {
  // Restrict outbound requests to global unicast; also exclude transition and documentation ranges.
  // This blocks compressed/expanded loopback, mapped IPv4, local, multicast and translation addresses.
  const normalized = new URL(`http://[${ip}]/`).hostname.slice(1, -1).toLowerCase();
  const first = Number.parseInt(normalized.split(":")[0] ?? "", 16);
  const second = Number.parseInt(normalized.split(":")[1] || "0", 16);
  return !Number.isFinite(first) || first < 0x2000 || first > 0x3fff || first === 0x2002 ||
    (first === 0x2001 && (second === 0 || second === 2 || second === 0xdb8 || (second >= 0x10 && second <= 0x2f)));
}

export function isBlockedIpAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    return isBlockedIpv4(ip);
  }
  if (version === 6) {
    return isBlockedIpv6(ip);
  }
  return true;
}

/**
 * Parse and reject unsafe URL shapes before any network I/O.
 * Does not resolve DNS. Call assertPreviewUrlAllowed for that.
 */
export function parsePreviewCandidateUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new PreviewUrlBlockedError("URL is not valid");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new PreviewUrlBlockedError("Only http and https URLs are allowed");
  }

  if (parsed.username || parsed.password) {
    throw new PreviewUrlBlockedError("URLs with credentials are not allowed");
  }

  if (!parsed.hostname) {
    throw new PreviewUrlBlockedError("URL host is required");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new PreviewUrlBlockedError("URL host is not allowed");
  }

  if (isIP(hostname) !== 0 && isBlockedIpAddress(hostname)) {
    throw new PreviewUrlBlockedError("URL host is not allowed");
  }

  return parsed;
}

export async function assertPreviewUrlAllowed(
  raw: string,
  resolveDns: typeof lookup = lookup,
): Promise<URL> {
  const parsed = parsePreviewCandidateUrl(raw);

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname) !== 0) {
    return parsed;
  }

  let lookupResult: Awaited<ReturnType<typeof lookup>>;
  try {
    lookupResult = await resolveDns(hostname, { all: false });
  } catch {
    throw new PreviewUrlBlockedError("URL host could not be resolved");
  }

  const address = typeof lookupResult === "string" ? lookupResult : lookupResult.address;
  if (isBlockedIpAddress(address)) {
    throw new PreviewUrlBlockedError("URL host resolves to a blocked address");
  }

  return parsed;
}
