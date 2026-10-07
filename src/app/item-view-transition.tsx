"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { readItemNavigation } from "./item-navigation-snapshot";

type Props = { itemId: string; assetId: string; source: boolean; kind?: "image" | "document"; children: React.ReactNode };

export function transitionLibraryLayout(update: () => void) {
  if (!React.ViewTransition || !React.addTransitionType || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    update();
    return;
  }
  React.startTransition(() => {
    React.addTransitionType("library-layout");
    update();
  });
}

export function LibraryLayoutTransition({ children }: { children: React.ReactNode }) {
  if (!React.ViewTransition) return children;
  return <React.ViewTransition default="none" update={{ "library-layout": "library-layout-crossfade", default: "none" }}>{children}</React.ViewTransition>;
}

export function ItemViewTransition(props: Props) {
  // Standalone React 19.2 test renderers do not export ViewTransition.
  if (!React.ViewTransition) return props.children;
  return <BrowserItemViewTransition {...props} />;
}

function BrowserItemViewTransition({ itemId, assetId, source, kind = "image", children }: Props) {
  const pathname = usePathname();
  const snapshot = readItemNavigation(itemId);
  if (source && pathname?.startsWith("/items/")) return children;
  if (!source && !snapshot?.animate) return children;
  return <React.ViewTransition name={`item-${kind}-${itemId}-${assetId}`} share={{ "library-layout": "none", default: "item-image-morph" }} default="none">{children}</React.ViewTransition>;
}
