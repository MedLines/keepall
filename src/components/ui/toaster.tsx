"use client";

import { useEffect, useState } from "react";
import { Toaster as Sonner, toast } from "sonner";

export { toast };

export function Toaster() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
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
