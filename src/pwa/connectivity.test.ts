import { afterEach, describe, expect, test, vi } from "vitest";
import { CONNECTIVITY_PROBE_PATH, probeNetworkReachable } from "./connectivity";

describe("probeNetworkReachable", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("returns true when fetch resolves with a response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await expect(probeNetworkReachable(100, fetchImpl)).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining(CONNECTIVITY_PROBE_PATH),
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
  });

  test("returns false when fetch rejects (no network)", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(probeNetworkReachable(100, fetchImpl)).resolves.toBe(false);
  });

  test("returns false when the probe times out", async () => {
    const fetchImpl = ((
      _input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      })) as typeof fetch;
    await expect(probeNetworkReachable(20, fetchImpl)).resolves.toBe(false);
  });
});