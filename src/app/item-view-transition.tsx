"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { usePathname } from "next/navigation";
import type { Item } from "@/domain/item";
import { readItemNavigation } from "./item-navigation-snapshot";

type Props = { itemId: string; assetId: string; source: boolean; preview?: boolean; kind?: "image" | "document"; children: React.ReactNode };

export const ItemPreviewSourceContext = React.createContext<string | null>(null);

export function transitionItemPreview(item: Item, update: (shared: boolean) => void) {
  const card = Array.from(document.querySelectorAll<HTMLElement>("[data-item-id]")).find(node => node.dataset.itemId === item.id);
  const media = card?.querySelector<HTMLElement>("[data-item-transition]");
  const source = media ?? (item.type === "note" || item.type === "link" ? card : undefined);
  const name = media?.dataset.itemTransition ?? (source ? `item-preview-content-${item.id}` : undefined);
  if (!source || !name || !document.startViewTransition) {
    update(false);
    return;
  }
  const captured: { node: HTMLElement; name: string; className: string }[] = [];
  const capture = (node: HTMLElement) => {
    captured.push({ node, name: node.style.viewTransitionName, className: node.style.viewTransitionClass });
    node.style.viewTransitionName = name;
    node.style.viewTransitionClass = media ? "item-image-morph" : "item-preview-content";
  };
  const cleanup = () => {
    for (const entry of captured) {
      if (entry.node.style.viewTransitionName !== name) continue;
      entry.node.style.viewTransitionName = entry.name;
      entry.node.style.viewTransitionClass = entry.className;
    }
  };
  capture(source);
  // Base UI's external dialog store settles synchronously inside the snapshot update.
  const transition = document.startViewTransition(() => {
    flushSync(() => update(true));
    cleanup();
    const target = media
      ? Array.from(document.querySelectorAll<HTMLElement>(".library-quick-preview [data-item-transition]")).find(node => node.dataset.itemTransition === name)
      : item.type === "link"
        ? document.querySelector<HTMLElement>('.library-quick-preview a[aria-label^="Open source:"]')?.parentElement
        : document.querySelector<HTMLElement>(".library-quick-preview .library-preview-document");
    if (target) capture(target);
  });
  void transition.ready.then(cleanup, cleanup);
  void transition.finished.catch(() => {});
}

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
  const children = React.isValidElement<Record<string, unknown>>(props.children)
    ? React.cloneElement(props.children, { "data-item-transition": `item-${props.kind ?? "image"}-${props.itemId}-${props.assetId}` })
    : props.children;
  // Standalone React 19.2 test renderers do not export ViewTransition.
  if (!React.ViewTransition) return children;
  return <BrowserItemViewTransition {...props}>{children}</BrowserItemViewTransition>;
}

type PreviewTransitionProps = { itemId: string; source?: boolean; children: React.ReactNode };

export function ItemPreviewTransition(props: PreviewTransitionProps) {
  if (!React.ViewTransition) return props.children;
  return <BrowserPreviewTransition {...props} kind="frame" />;
}

export function ItemPreviewContentTransition(props: PreviewTransitionProps & { assetId?: string }) {
  if (!React.ViewTransition) return props.children;
  return <BrowserPreviewTransition {...props} kind="content" />;
}

function BrowserPreviewTransition({ itemId, assetId, source, children, kind }: PreviewTransitionProps & { assetId?: string; kind: "frame" | "content" }) {
  const pathname = usePathname();
  const snapshot = readItemNavigation(itemId);
  if (!source && (!pathname?.startsWith("/items/") || !snapshot?.fromPreview || !snapshot.animate)) return children;
  const name = kind === "frame" ? `item-preview-${itemId}` : `item-preview-content-${itemId}${assetId ? `-${assetId}` : ""}`;
  return <React.ViewTransition name={name} share={`item-preview-${kind}`} default="none">{children}</React.ViewTransition>;
}

function BrowserItemViewTransition({ itemId, assetId, source, preview = false, kind = "image", children }: Props) {
  const pathname = usePathname();
  const previewItemId = React.useContext(ItemPreviewSourceContext);
  const snapshot = readItemNavigation(itemId);
  if (source && !preview && (previewItemId === "*" || previewItemId === itemId)) return children;
  if (source && pathname?.startsWith("/items/")) return children;
  if (!source && !snapshot?.animate) return children;
  return <React.ViewTransition name={`item-${kind}-${itemId}-${assetId}`} share={{ "library-layout": "none", default: "item-image-morph" }} default="none">{children}</React.ViewTransition>;
}
