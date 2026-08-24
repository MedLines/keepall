import { afterEach, describe, expect, test, vi } from "vitest";
import { activateWaitingServiceWorker } from "./service-worker-update";

describe("activateWaitingServiceWorker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  test("reloads immediately when no worker is waiting", () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });
    vi.stubGlobal("navigator", { serviceWorker: { addEventListener: vi.fn() } });

    activateWaitingServiceWorker(null);

    expect(reload).toHaveBeenCalledOnce();
  });

  test("attaches controllerchange before posting SKIP_WAITING", () => {
    vi.useFakeTimers();
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

    activateWaitingServiceWorker(waitingWorker, { fallbackReloadMs: 1_500 });

    expect(callOrder).toEqual(["listen", "post"]);
    expect(addEventListener).toHaveBeenCalledWith(
      "controllerchange",
      expect.any(Function),
      { once: true },
    );
    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(reload).not.toHaveBeenCalled();
  });

  test("falls back to reload if controllerchange never fires", () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    const postMessage = vi.fn();
    const waitingWorker = { postMessage } as unknown as ServiceWorker;

    vi.stubGlobal("location", { reload });
    vi.stubGlobal("navigator", {
      serviceWorker: { addEventListener: vi.fn() },
    });

    activateWaitingServiceWorker(waitingWorker, { fallbackReloadMs: 1_500 });

    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_500);
    expect(reload).toHaveBeenCalledOnce();
  });

  test("reloads only once when controllerchange and fallback both run", () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    let onControllerChange: (() => void) | undefined;
    const addEventListener = vi.fn(
      (_type: string, listener: EventListenerOrEventListenerObject) => {
        onControllerChange =
          typeof listener === "function"
            ? (listener as () => void)
            : () => listener.handleEvent(new Event("controllerchange"));
      },
    );
    const waitingWorker = {
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;

    vi.stubGlobal("location", { reload });
    vi.stubGlobal("navigator", { serviceWorker: { addEventListener } });

    activateWaitingServiceWorker(waitingWorker, { fallbackReloadMs: 1_500 });
    onControllerChange?.();
    vi.advanceTimersByTime(1_500);

    expect(reload).toHaveBeenCalledOnce();
  });
});
