/// <reference lib="webworker" />

import { defaultCache, PAGES_CACHE_NAME } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Must match CONNECTIVITY_PROBE_PATH in src/pwa/connectivity.ts
const CONNECTIVITY_PROBE_PATH = "/api/connectivity";

/** How long to wait on the network before serving a cached shell when offline/slow. */
const NAVIGATION_NETWORK_TIMEOUT_SECONDS = 2;

// skipWaiting false: new shell waits until the user chooses Reload.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Probe must hit the network so offline detection is not fooled by Cache Storage.
    {
      matcher: ({ url }) => url.pathname === CONNECTIVITY_PROBE_PATH,
      handler: new NetworkOnly({
        networkTimeoutSeconds: NAVIGATION_NETWORK_TIMEOUT_SECONDS,
      }),
    },
    // Prefer a short network attempt, then Cache Storage — avoids ~10s tab spinners
    // when airplane mode leaves the browser thinking it is still online.
    {
      matcher: ({ request, sameOrigin, url: { pathname } }) =>
        request.mode === "navigate" &&
        sameOrigin &&
        !pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: PAGES_CACHE_NAME.html,
        networkTimeoutSeconds: NAVIGATION_NETWORK_TIMEOUT_SECONDS,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60,
          }),
        ],
      }),
    },
    {
      matcher: ({ request, url: { pathname }, sameOrigin }) =>
        request.headers.get("RSC") === "1" &&
        sameOrigin &&
        !pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: PAGES_CACHE_NAME.rsc,
        networkTimeoutSeconds: NAVIGATION_NETWORK_TIMEOUT_SECONDS,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60,
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
