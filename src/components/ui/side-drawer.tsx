"use client";

import { captureStyles } from "@/app/capture-styles";
import type { ComponentProps, ReactNode } from "react";
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
  initialFocus?: ComponentProps<typeof Drawer.Popup>["initialFocus"];
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
  initialFocus,
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
        <Drawer.Backdrop className="ui-backdrop ui-drawer-backdrop fixed inset-0 z-[70]" />
        <Drawer.Viewport
          className={`fixed inset-0 z-[70] flex overflow-hidden ${
            fromRight ? "justify-end" : "justify-start"
          }`}
        >
          <Drawer.Popup
            initialFocus={initialFocus}
            data-side={side}
            className={`ui-drawer-popup flex h-dvh ${widthClassName} flex-col overflow-hidden border-border-control bg-bg-canvas text-text-primary shadow-menu outline-none ${
              fromRight
                ? "border-l"
                : "border-r"
            }`}
          >
            <Drawer.Content className="flex min-h-0 flex-1 flex-col">
              <header className={captureStyles["header"]}>
                <div className={captureStyles["heading"]}>
                  <Drawer.Title className={captureStyles["title"]}>
                    {title}
                  </Drawer.Title>
                  {description ? (
                    <Drawer.Description className={captureStyles["description"]}>
                      {description}
                    </Drawer.Description>
                  ) : null}
                </div>
                <Drawer.Close
                  aria-label="Close drawer"
                  disabled={closeDisabled}
                  className={captureStyles["close"]}
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
