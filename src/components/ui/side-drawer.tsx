"use client";

import type { ReactNode } from "react";
import {
  Drawer,
  type DrawerRootChangeEventDetails,
} from "@base-ui/react/drawer";
import { CloseIcon } from "@/app/shell-icons";

type SideDrawerProps = {
  open: boolean;
  onOpenChange: (
    open: boolean,
    eventDetails: DrawerRootChangeEventDetails,
  ) => void;
  side?: "left" | "right";
  title: string;
  description?: string;
  widthClassName?: string;
  closeDisabled?: boolean;
  children: ReactNode;
};

export function SideDrawer({
  open,
  onOpenChange,
  side = "right",
  title,
  description,
  widthClassName = "w-[min(30rem,100vw)]",
  closeDisabled = false,
  children,
}: SideDrawerProps) {
  const fromRight = side === "right";

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      swipeDirection={side}
    >
      <Drawer.Portal>
        <Drawer.Backdrop className="ui-backdrop fixed inset-0 z-[70]" />
        <Drawer.Viewport
          className={`fixed inset-0 z-[70] flex overflow-hidden ${
            fromRight ? "justify-end" : "justify-start"
          }`}
        >
          <Drawer.Popup
            className={`ui-drawer-popup flex h-dvh ${widthClassName} flex-col overflow-hidden border-border-control bg-bg-canvas text-text-primary shadow-menu ${
              fromRight
                ? "border-l data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full"
                : "border-r data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full"
            }`}
          >
            <Drawer.Content className="flex min-h-0 flex-1 flex-col">
              <header className="flex shrink-0 items-start gap-4 px-7 py-6">
                <div className="min-w-0 flex-1">
                  <Drawer.Title className="[overflow-wrap:anywhere] text-[22px] font-semibold tracking-tight">
                    {title}
                  </Drawer.Title>
                  {description ? (
                    <Drawer.Description className="mt-1 [overflow-wrap:anywhere] text-sm leading-relaxed text-text-secondary">
                      {description}
                    </Drawer.Description>
                  ) : null}
                </div>
                <Drawer.Close
                  aria-label="Close drawer"
                  disabled={closeDisabled}
                  className="ui-control flex size-10 shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CloseIcon />
                </Drawer.Close>
              </header>
              {children}
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
