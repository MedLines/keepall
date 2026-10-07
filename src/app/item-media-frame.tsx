import type { ReactNode } from "react";

export function ItemMediaFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`item-workspace-media relative isolate flex h-[var(--item-viewer-height)] items-center justify-center overflow-hidden rounded-card bg-bg-image-viewer ${className}`}>
    {children}
  </div>;
}
