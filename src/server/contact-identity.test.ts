import { beforeEach, expect, test, vi } from "vitest";
import { contactIdentity } from "./contact-identity";

const secret = "a-server-only-secret-with-at-least-32-characters";
function request(ip?: string) {
  return new Request("https://keepall.app/api/contact", { headers: ip ? { "x-vercel-forwarded-for": ip } : {} });
}

beforeEach(() => { vi.unstubAllEnvs(); vi.stubEnv("VERCEL", "1"); });

test("uses provider client IP and ignores caller-selected forwarding headers", () => {
  const source = request("203.0.113.8");
  const expected = contactIdentity(source, "Ada@Example.com", secret);
  source.headers.set("x-forwarded-for", "198.51.100.99");
  source.headers.set("x-real-ip", "198.51.100.98");
  expect(contactIdentity(source, "ada@example.com", secret)).toEqual(expected);
  expect(expected?.ipKey).not.toContain("203.0.113");
  expect(expected?.emailKey).not.toContain("example.com");
  expect(contactIdentity(source, "ada@example.com", secret + "changed")).not.toEqual(expected);
});

test.each([undefined, "", "unknown", "203.0.113.8, 198.51.100.99"])("fails closed without a single valid provider IP: %s", ip => {
  const source = request(ip);
  source.headers.set("x-forwarded-for", "203.0.113.8");
  expect(contactIdentity(source, "ada@example.com", secret)).toBeNull();
});

test("IPv6 privacy addresses in one /64 share a network limit", () => {
  const first = contactIdentity(request("2001:db8:1234:5678::1"), "ada@example.com", secret);
  expect(contactIdentity(request("2001:0db8:1234:5678:abcd:ef01:2:3"), "ada@example.com", secret)).toEqual(first);
  expect(contactIdentity(request("2001:db8:1234:5679::1"), "ada@example.com", secret)?.ipKey).not.toBe(first?.ipKey);
});

test("IPv4-mapped IPv6 and IPv4 use the same network identity", () => {
  expect(contactIdentity(request("::ffff:203.0.113.8"), "ada@example.com", secret))
    .toEqual(contactIdentity(request("203.0.113.8"), "ada@example.com", secret));
});

test("non-Vercel production cannot enable spoofable IP headers", () => {
  vi.stubEnv("VERCEL", ""); vi.stubEnv("NODE_ENV", "production");
  expect(contactIdentity(request("203.0.113.8"), "ada@example.com", secret)).toBeNull();
  expect(contactIdentity(new Request("http://localhost:3115/api/contact"), "ada@example.com", secret)).toBeNull();
});

test("local development uses a shared loopback bucket rather than supplied headers", () => {
  vi.stubEnv("VERCEL", ""); vi.stubEnv("NODE_ENV", "development");
  const local = new Request("http://localhost:3115/api/contact");
  const expected = contactIdentity(local, "ada@example.com", secret);
  expect(expected).not.toBeNull();
  local.headers.set("x-vercel-forwarded-for", "198.51.100.3");
  expect(contactIdentity(local, "ada@example.com", secret)).toEqual(expected);
  expect(contactIdentity(request(), "ada@example.com", secret)).toBeNull();
});
