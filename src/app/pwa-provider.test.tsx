import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const getClientOriginDeploymentPolicy = vi.fn();
const requestPersistentStorage = vi.fn().mockResolvedValue("granted");

vi.mock("@/pwa/origin-policy-client", () => ({
  getClientOriginDeploymentPolicy,
}));

vi.mock("@/pwa/persistent-storage", () => ({
  requestPersistentStorage,
  persistentStorageMessage: (status: string) => status,
}));

vi.mock("@/pwa/connectivity", () => ({
  probeNetworkReachable: vi.fn().mockResolvedValue(true),
}));

describe("PwaProvider", () => {
  const register = vi.fn().mockResolvedValue({
    waiting: null,
    addEventListener: vi.fn(),
  });

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    register.mockClear();
    requestPersistentStorage.mockClear();
    getClientOriginDeploymentPolicy.mockReset();

    vi.stubGlobal("navigator", {
      onLine: true,
      serviceWorker: {
        register,
        controller: null,
        addEventListener: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("registers SW and requests persistence after policy resolves", async () => {
    getClientOriginDeploymentPolicy.mockReturnValue({
      canonicalOrigin: "https://keepall.app",
      registerServiceWorker: true,
      requestPersistentStorage: true,
      showNonCanonicalWarning: false,
      showMissingConfigurationWarning: false,
    });

    const { PwaProvider } = await import("./pwa-provider");
    render(
      <PwaProvider>
        <p>Library</p>
      </PwaProvider>,
    );

    expect(screen.queryByTestId("non-canonical-origin-warning")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("missing-origin-configuration-warning"),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith("/sw.js", {
        scope: "/",
        type: "classic",
      });
      expect(requestPersistentStorage).toHaveBeenCalledOnce();
    });
  });

  test("shows warning and skips SW registration on non-canonical origins", async () => {
    getClientOriginDeploymentPolicy.mockReturnValue({
      canonicalOrigin: "https://keepall.app",
      registerServiceWorker: false,
      requestPersistentStorage: false,
      showNonCanonicalWarning: true,
      showMissingConfigurationWarning: false,
    });

    const { PwaProvider } = await import("./pwa-provider");
    render(
      <PwaProvider>
        <p>Library</p>
      </PwaProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("non-canonical-origin-warning"),
      ).toHaveTextContent(/not your real Keepall library/i);
    });
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://keepall.app",
    );

    await waitFor(() => {
      expect(register).not.toHaveBeenCalled();
      expect(requestPersistentStorage).not.toHaveBeenCalled();
    });
  });

  test("shows configuration warning when canonical env is missing", async () => {
    getClientOriginDeploymentPolicy.mockReturnValue({
      canonicalOrigin: null,
      registerServiceWorker: false,
      requestPersistentStorage: false,
      showNonCanonicalWarning: false,
      showMissingConfigurationWarning: true,
    });

    const { PwaProvider } = await import("./pwa-provider");
    render(
      <PwaProvider>
        <p>Library</p>
      </PwaProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("missing-origin-configuration-warning"),
      ).toHaveTextContent(/NEXT_PUBLIC_KEEPALL_ORIGIN/i);
    });

    await waitFor(() => {
      expect(register).not.toHaveBeenCalled();
      expect(requestPersistentStorage).not.toHaveBeenCalled();
    });
  });
});
