/**
 * Activate a waiting worker and reload once it takes control.
 * Attaches controllerchange before SKIP_WAITING to avoid missing the event.
 */
export function activateWaitingServiceWorker(
  waitingWorker: ServiceWorker | null,
): void {
  if (!waitingWorker) {
    window.location.reload();
    return;
  }

  navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => {
      window.location.reload();
    },
    { once: true },
  );

  waitingWorker.postMessage({ type: "SKIP_WAITING" });
}
