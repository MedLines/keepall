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
  widthClassName = "w-[min(28rem,calc(100vw-1rem))]",
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
        <Drawer.Backdrop className="fixed inset-0 z-[70] bg-bg-overlay/35 opacity-100 backdrop-blur-[1px] transition-opacity duration-200 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Drawer.Viewport
          className={`fixed inset-0 z-[70] flex overflow-hidden p-2 ${
            fromRight ? "justify-end" : "justify-start"
          }`}
        >
          <Drawer.Popup
            className={`flex h-[calc(100dvh-1rem)] ${widthClassName} flex-col overflow-hidden rounded-panel border border-border-edge bg-bg-surface text-text-primary shadow-menu transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${
              fromRight
                ? "data-[ending-style]:translate-x-[calc(100%+0.5rem)] data-[starting-style]:translate-x-[calc(100%+0.5rem)]"
                : "data-[ending-style]:-translate-x-[calc(100%+0.5rem)] data-[starting-style]:-translate-x-[calc(100%+0.5rem)]"
            }`}
          >
            <Drawer.Content className="flex min-h-0 flex-1 flex-col">
              <header className="flex shrink-0 items-start gap-4 border-b border-border-edge px-5 py-4">
                <div className="min-w-0 flex-1">
                  <Drawer.Title className="text-lg font-semibold tracking-tight">
                    {title}
                  </Drawer.Title>
                  {description ? (
                    <Drawer.Description className="mt-1 text-sm leading-relaxed text-text-secondary">
                      {description}
                    </Drawer.Description>
                  ) : null}
                </div>
                <Drawer.Close
                  aria-label="Close drawer"
                  disabled={closeDisabled}
                  className="flex size-10 shrink-0 items-center justify-center rounded-control text-text-secondary transition-[background-color,color,scale] duration-150 ease-out hover:bg-bg-raised hover:text-text-primary active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-[background-color,color] motion-reduce:active:scale-100"
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
