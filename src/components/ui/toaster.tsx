"use client";

import { useSyncExternalStore } from "react";
import { Toaster as Sonner, toast } from "sonner";
import { useTranslations } from "@/i18n/use-translations";

export { toast };

const subscribeToNothing = () => () => {};

/**
 * Mount once at the app root to show toast() notices; library undo and status notices use the top bar instead.
 *
 * @import import { Toaster } from "@/components/ui/toaster";
 */
export function Toaster() {
  // False on the server and during hydration, true after; keeps Sonner out of SSR markup.
  const mounted = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  const t = useTranslations("Toaster");
  if (!mounted) return null;
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      offset={24}
      className="kc-toaster"
      containerAriaLabel={t("notifications")}
      toastOptions={{
        className: "kc-toast",
      }}
    />
  );
}
