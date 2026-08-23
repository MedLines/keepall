import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const useOffline = vi.fn(() => false);

vi.mock("next/offline", () => ({
  useOffline: () => useOffline(),
}));

describe("OfflineBanner", () => {
  beforeEach(() => {
    useOffline.mockReturnValue(false);
    vi.stubGlobal("navigator", { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("renders nothing while online", async () => {
    const { OfflineBanner } = await import("./offline-banner");
    const { container } = render(<OfflineBanner />);
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  test("announces offline from useOffline", async () => {
    useOffline.mockReturnValue(true);
    const { OfflineBanner } = await import("./offline-banner");
    render(<OfflineBanner />);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/You’re offline/i);
    });
  });

  test("announces offline from navigator.onLine on cold load", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const { OfflineBanner } = await import("./offline-banner");
    render(<OfflineBanner />);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/You’re offline/i);
    });
  });
});
