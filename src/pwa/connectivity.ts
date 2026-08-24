/** Same-origin path the service worker must handle with NetworkOnly. */
export const CONNECTIVITY_PROBE_PATH = "/api/connectivity";

/**
 * Returns true when a network response arrives (any status).
 * Returns false when the request fails (offline, DNS, abort, etc.).
 * Does not trust navigator.onLine — that flag can stay true with no internet.
 */
export async function probeNetworkReachable(
  timeoutMs = 4_000,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetchImpl(`${CONNECTIVITY_PROBE_PATH}?t=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
