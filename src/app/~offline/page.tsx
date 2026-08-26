export default function OfflineFallbackPage() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-3xl font-semibold tracking-tight">Keepall</h1>
      <p className="mt-4 text-sm text-zinc-700">
        You are offline and this page is not in the cached app shell yet. Open
        Keepall once while online, then it can load from this device without a
        network.
      </p>
      <p className="mt-2 text-sm text-zinc-600">
        Your library still lives in IndexedDB on this browser, not in the
        service worker cache.
      </p>
    </main>
  );
}
