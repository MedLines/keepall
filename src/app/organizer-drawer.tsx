"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { ReactNode } from "react";
import { SideDrawer } from "@/components/ui/side-drawer";

export function OrganizerDrawer({
  open, onOpenChange, side, title, description, disabled, error, children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: "left" | "right";
  title: string;
  description: string;
  disabled: boolean;
  children: ReactNode;
  error?: string | null;
}) {
  return (
    <SideDrawer
      open={open} side={side} title={title} description={description}
      closeDisabled={disabled}
      onOpenChange={(nextOpen, details) => {
        if (!nextOpen && disabled) { details.cancel(); return; }
        onOpenChange(nextOpen);
      }}
    >
      <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade overscroll-contain">
        <div className="flex flex-col gap-8 px-5 py-5">
          {children}
          {error ? <p role="alert" className="text-sm text-text-danger">{error}</p> : null}
        </div>
      </ScrollArea>
      <footer className="shrink-0 border-t border-border-control px-5 py-4">
        <button type="button" className="ui-primary min-h-10 w-full px-4 text-sm font-medium disabled:opacity-60" disabled={disabled} onClick={() => onOpenChange(false)}>Done</button>
      </footer>
    </SideDrawer>
  );
}
