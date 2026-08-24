/**
 * Activate a waiting worker and reload once it takes control.
 * Attaches controllerchange before SKIP_WAITING to avoid missing the event.
 * Falls back to reload if controllerchange never fires (broken SW / stuck waiting).
 */
export function activateWaitingServiceWorker(
  waitingWorker: ServiceWorker | null,
  options: { fallbackReloadMs?: number } = {},
): void {
  const fallbackReloadMs = options.fallbackReloadMs ?? 1_500;

  if (!waitingWorker) {
    window.location.reload();
    return;
  }

  let reloaded = false;
  const reloadOnce = () => {
    if (reloaded) {
      return;
    }
    reloaded = true;
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => {
      reloadOnce();
    },
    { once: true },
  );

  waitingWorker.postMessage({ type: "SKIP_WAITING" });

  window.setTimeout(() => {
    reloadOnce();
  }, fallbackReloadMs);
}
