import type { ComponentPropsWithoutRef } from "react";

export function ItemMediaFrame({ children, className = "", ...props }: ComponentPropsWithoutRef<"div">) {
  return <div {...props} className={`item-workspace-media relative isolate flex h-[var(--item-viewer-height)] items-center justify-center overflow-hidden rounded-card bg-bg-image-viewer ${className}`}>
    {children}
  </div>;
}
