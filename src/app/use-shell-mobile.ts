"use client";

import { useEffect, useState } from "react";

const MOBILE_SHELL_QUERY = "(max-width: 767px)";

export function useShellMobile(): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia(MOBILE_SHELL_QUERY);
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return mobile;
}

export function isShellMobileViewport(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(MOBILE_SHELL_QUERY).matches;
}
