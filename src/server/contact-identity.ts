import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export type ContactIdentity = { ipKey: string; emailKey: string };

function networkAddress(address: string): string | null {
  const version = isIP(address);
  if (version === 4) return address;
  if (version !== 6 || address.includes("%")) return null;
  const canonical = new URL(`http://[${address}]`).hostname.slice(1, -1);
  const mapped = canonical.match(/^::ffff:([0-9a-f]+):([0-9a-f]+)$/);
  if (mapped) {
    const value = [parseInt(mapped[1], 16), parseInt(mapped[2], 16)];
    return [value[0] >> 8, value[0] & 255, value[1] >> 8, value[1] & 255].join(".");
  }
  const [left, right] = canonical.split("::");
  const start = left ? left.split(":") : [];
  const end = right ? right.split(":") : [];
  const parts = right === undefined ? start : [...start, ...Array(8 - start.length - end.length).fill("0"), ...end];
  return `${parts.slice(0, 4).map(part => part.padStart(4, "0")).join(":")}::/64`;
}

export function contactIdentity(request: Request, email: string, secret: string): ContactIdentity | null {
  let network: string | null = null;
  if (process.env.VERCEL === "1") {
    // Vercel overwrites this header at its ingress. Never fall back to caller-selected IP headers.
    network = networkAddress(request.headers.get("x-vercel-forwarded-for")?.trim() ?? "");
  } else if (process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname)) {
    network = "local-development";
  }
  if (!network) return null;
  const hash = (kind: string, value: string) => `${kind}:${createHmac("sha256", secret).update(`${kind}:${value}`).digest("hex")}`;
  return { ipKey: hash("ip", network), emailKey: hash("email", email.trim().toLowerCase()) };
}
