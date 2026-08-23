import { afterEach, describe, expect, test, vi } from "vitest";
import { activateWaitingServiceWorker } from "./service-worker-update";

describe("activateWaitingServiceWorker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("reloads immediately when no worker is waiting", () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });
    vi.stubGlobal("navigator", { serviceWorker: { addEventListener: vi.fn() } });

    activateWaitingServiceWorker(null);

    expect(reload).toHaveBeenCalledOnce();
  });

  test("attaches controllerchange before posting SKIP_WAITING", () => {
    const reload = vi.fn();
    const callOrder: string[] = [];
    const addEventListener = vi.fn(() => {
      callOrder.push("listen");
    });
    const postMessage = vi.fn(() => {
      callOrder.push("post");
    });
    const waitingWorker = { postMessage } as unknown as ServiceWorker;

    vi.stubGlobal("location", { reload });
    vi.stubGlobal("navigator", { serviceWorker: { addEventListener } });

    activateWaitingServiceWorker(waitingWorker);

    expect(callOrder).toEqual(["listen", "post"]);
    expect(addEventListener).toHaveBeenCalledWith(
      "controllerchange",
      expect.any(Function),
      { once: true },
    );
    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(reload).not.toHaveBeenCalled();
  });
});
