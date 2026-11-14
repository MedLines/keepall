"use client";

import { useSyncExternalStore } from "react";
import { Toaster as Sonner, toast } from "sonner";

export { toast };

const subscribeToNothing = () => () => {};

/** DRAFT: Mount once at the app root to show toast() notices; library undo and status notices use the top bar instead. */
export function Toaster() {
  // False on the server and during hydration, true after; keeps Sonner out of SSR markup.
  const mounted = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  if (!mounted) return null;
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      offset={24}
      className="kc-toaster"
      toastOptions={{
        className: "kc-toast",
      }}
    />
  );
}
