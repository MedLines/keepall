import { Suspense } from "react";
import { BuildMarker } from "./build-marker";
import { Library } from "./library";

export default function HomePage() {
  return (
    <>
      <BuildMarker />
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center bg-zinc-50">
            <p className="text-sm text-zinc-600">Loading…</p>
          </div>
        }
      >
        <Library />
      </Suspense>
    </>
  );
}
