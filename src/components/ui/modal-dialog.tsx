"use client";

import { Dialog } from "@base-ui/react/dialog";
import type { FocusEventHandler, ReactNode } from "react";
import { ScrollArea } from "./scroll-area";
import { CloseIcon } from "@/app/shell-icons";

export function ModalDialog({
  open, onOpenChange, title, description, busy = false, closeLabel = "Close",
  size = "compact", children, footer, onSubmit, onDismiss, onFocusCapture,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  busy?: boolean;
  closeLabel?: string;
  size?: "compact" | "editor";
  children?: ReactNode;
  footer: ReactNode;
  onSubmit?: () => void;
  onDismiss?: (details: Dialog.Root.ChangeEventDetails) => void;
  onFocusCapture?: FocusEventHandler<HTMLElement>;
}) {
  const content = <>
    {children ? (
      <ScrollArea className="flex min-h-0 flex-1 flex-col" viewportClassName="scroll-fade min-h-0 flex-1">
        <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">{children}</div>
      </ScrollArea>
    ) : null}
    <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border-control px-5 py-4 sm:px-6">{footer}</footer>
  </>;
  return (
    <Dialog.Root
      open={open} disablePointerDismissal={busy}
      onOpenChange={(nextOpen, details) => {
        if (!nextOpen && busy) { details.cancel(); return; }
        if (!nextOpen && onDismiss) { onDismiss(details); return; }
        onOpenChange(nextOpen);
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="ui-backdrop fixed inset-0 z-[80]" />
        <Dialog.Viewport className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto p-4">
          <Dialog.Popup onFocusCapture={onFocusCapture} className={`confirm-dialog-popup ui-popover flex w-full flex-col overflow-hidden p-0 outline-none ${size === "editor" ? "h-[min(44rem,calc(100dvh-2rem))] max-w-[42rem]" : "max-h-[calc(100dvh-2rem)] max-w-[30rem]"}`}>
            <header className="flex shrink-0 items-start gap-4 border-b border-border-control px-5 py-5 sm:px-6">
              <div className="min-w-0 flex-1">
                <Dialog.Title className="[overflow-wrap:anywhere] text-xl font-semibold text-text-primary">{title}</Dialog.Title>
                <Dialog.Description className="mt-1 [overflow-wrap:anywhere] text-sm leading-relaxed text-text-secondary">{description}</Dialog.Description>
              </div>
              <Dialog.Close aria-label={closeLabel} disabled={busy} className="ui-control flex size-10 shrink-0 items-center justify-center disabled:opacity-60"><CloseIcon /></Dialog.Close>
            </header>
            {onSubmit ? (
              <form className="flex min-h-0 flex-1 flex-col"
                onSubmit={(event) => { event.preventDefault(); if (!busy) onSubmit(); }}
                onKeyDown={(event) => {
                  if ((event.target as HTMLElement).closest("[role=dialog]") !== event.currentTarget.closest("[role=dialog]")) return;
                  if (!event.defaultPrevented && (event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.preventDefault();
                    if (!busy) event.currentTarget.requestSubmit();
                  }
                }}
              >{content}</form>
            ) : content}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
