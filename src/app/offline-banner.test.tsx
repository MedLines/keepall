import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const probeNetworkReachable = vi.fn();

vi.mock("@/pwa/connectivity", () => ({
  probeNetworkReachable: (...args: unknown[]) => probeNetworkReachable(...args),
}));

describe("OfflineBanner", () => {
  beforeEach(() => {
    probeNetworkReachable.mockReset();
    probeNetworkReachable.mockResolvedValue(true);
    vi.stubGlobal("navigator", { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("renders nothing while reachable", async () => {
    const { OfflineBanner } = await import("./offline-banner");
    const { container } = render(<OfflineBanner />);
    await waitFor(() => {
      expect(probeNetworkReachable).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  test("announces offline when the connectivity probe fails", async () => {
    probeNetworkReachable.mockResolvedValue(false);
    const { OfflineBanner } = await import("./offline-banner");
    render(<OfflineBanner />);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/You are offline/i);
    });
  });

  test("announces offline from navigator.onLine on cold load", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const { OfflineBanner } = await import("./offline-banner");
    render(<OfflineBanner />);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/You are offline/i);
    });
  });
});
