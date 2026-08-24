import { Suspense } from "react";
import { BackupPanel } from "./backup-panel";
import { BuildMarker } from "./build-marker";
import { Library } from "./library";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <BuildMarker />
      <h1 className="text-3xl font-semibold tracking-tight">Keepall</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Press Alt+K or ⌥K to save a link or note.
      </p>
      <Suspense
        fallback={<p className="mt-8 text-sm text-zinc-600">Loading…</p>}
      >
        <Library />
      </Suspense>
      <BackupPanel />
    </main>
  );
}
