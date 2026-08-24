import { describe, expect, test, vi } from "vitest";
import {
  assertPreviewUrlAllowed,
  isBlockedIpAddress,
  parsePreviewCandidateUrl,
  PreviewUrlBlockedError,
} from "./preview-ssrf";

describe("parsePreviewCandidateUrl", () => {
  test("accepts a normal https URL", () => {
    expect(parsePreviewCandidateUrl("https://example.com/x").hostname).toBe(
      "example.com",
    );
  });

  test("rejects javascript and credentialed URLs", () => {
    expect(() => parsePreviewCandidateUrl("javascript:alert(1)")).toThrow(
      PreviewUrlBlockedError,
    );
    expect(() =>
      parsePreviewCandidateUrl("https://user:pass@example.com"),
    ).toThrow(PreviewUrlBlockedError);
  });

  test("rejects literal metadata and loopback IPs", () => {
    expect(() => parsePreviewCandidateUrl("http://169.254.169.254/latest")).toThrow(
      PreviewUrlBlockedError,
    );
    expect(() => parsePreviewCandidateUrl("http://127.0.0.1/")).toThrow(
      PreviewUrlBlockedError,
    );
    expect(() => parsePreviewCandidateUrl("http://localhost/")).toThrow(
      PreviewUrlBlockedError,
    );
  });
});

describe("isBlockedIpAddress", () => {
  test("blocks private and metadata ranges", () => {
    expect(isBlockedIpAddress("10.0.0.1")).toBe(true);
    expect(isBlockedIpAddress("192.168.1.1")).toBe(true);
    expect(isBlockedIpAddress("169.254.169.254")).toBe(true);
    expect(isBlockedIpAddress("8.8.8.8")).toBe(false);
  });
});

describe("assertPreviewUrlAllowed", () => {
  test("rejects hosts that resolve to blocked addresses", async () => {
    const resolveDns = vi.fn().mockResolvedValue({ address: "169.254.169.254", family: 4 });
    await expect(
      assertPreviewUrlAllowed("https://evil.example", resolveDns),
    ).rejects.toBeInstanceOf(PreviewUrlBlockedError);
  });

  test("allows hosts that resolve to public addresses", async () => {
    const resolveDns = vi.fn().mockResolvedValue({ address: "93.184.216.34", family: 4 });
    const url = await assertPreviewUrlAllowed("https://example.com/page", resolveDns);
    expect(url.hostname).toBe("example.com");
  });
});
