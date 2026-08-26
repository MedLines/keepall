import { Suspense } from "react";
import Link from "next/link";
import { BackupPanel } from "./backup-panel";
import { BuildMarker } from "./build-marker";
import { Library } from "./library";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <BuildMarker />
      <h1 className="text-3xl font-semibold tracking-tight">
        <Link
          href="/"
          className="text-inherit no-underline hover:opacity-80"
        >
          Keepall
        </Link>
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Press Alt+K or ⌥K to save a link, note, or image.
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
