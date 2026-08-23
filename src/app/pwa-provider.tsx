"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { getClientOriginDeploymentPolicy } from "@/pwa/origin-policy-client";
import type { OriginDeploymentPolicy } from "@/pwa/canonical-origin";
import { activateWaitingServiceWorker } from "@/pwa/service-worker-update";
import { MissingOriginConfigurationWarning } from "./missing-origin-configuration-warning";
import { NonCanonicalOriginWarning } from "./non-canonical-origin-warning";
import { OfflineBanner } from "./offline-banner";
import { PersistentStorageStatusLine } from "./persistent-storage-status";
import { PwaUpdateBanner } from "./pwa-update-banner";

const serwistDisabled = process.env.NODE_ENV !== "production";

/**
 * Registers the Serwist-built classic `/sw.js` after mount.
 * Avoids SerwistProvider’s useState initializer (null on SSR, never retries)
 * and its default `type: "module"` registration.
 */
export function PwaProvider({ children }: { children: ReactNode }) {
  const [updateReady, setUpdateReady] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(
    null,
  );
  const [policy, setPolicy] = useState<OriginDeploymentPolicy | null>(null);

  useLayoutEffect(() => {
    // Resolve in the browser after SSR so markup matches hydration (policy starts null).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-mount origin read
    setPolicy(getClientOriginDeploymentPolicy());
  }, []);

  useEffect(() => {
    if (
      !policy?.registerServiceWorker ||
      serwistDisabled ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    let cancelled = false;

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", type: "classic" })
      .then((registration) => {
        if (cancelled) {
          return;
        }

        const trackWaiting = () => {
          if (registration.waiting) {
            setWaitingWorker(registration.waiting);
            setUpdateReady(true);
          }
        };

        trackWaiting();

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) {
            return;
          }
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setWaitingWorker(registration.waiting);
              setUpdateReady(true);
            }
          });
        });
      })
      .catch(() => {
        // Registration can fail in unsupported contexts; library still works online.
      });

    return () => {
      cancelled = true;
    };
  }, [policy]);

  return (
    <>
      {policy?.showMissingConfigurationWarning ? (
        <MissingOriginConfigurationWarning />
      ) : null}
      {policy?.showNonCanonicalWarning && policy.canonicalOrigin ? (
        <NonCanonicalOriginWarning canonicalOrigin={policy.canonicalOrigin} />
      ) : null}
      <OfflineBanner />
      {policy ? (
        <PersistentStorageStatusLine
          requestPersistentStorage={policy.requestPersistentStorage}
        />
      ) : null}
      {updateReady ? (
        <PwaUpdateBanner
          onReload={() => {
            activateWaitingServiceWorker(waitingWorker);
          }}
        />
      ) : null}
      {children}
    </>
  );
}
