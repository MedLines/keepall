"use client";

import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode, RefObject } from "react";
import { CloseIcon } from "@/app/shell-icons";
import { Button, buttonClassName, iconButtonClassName } from "./button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  cancelRef?: RefObject<HTMLButtonElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  pendingLabel?: string;
  busy?: boolean;
  onCancelWhileBusy?: () => void;
  cancelPending?: boolean;
  error?: string | null;
  confirmRef?: RefObject<HTMLButtonElement | null>;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  cancelRef,
  returnFocusRef,
  pendingLabel = "Working…",
  busy = false,
  onCancelWhileBusy,
  cancelPending = false,
  error = null,
  confirmRef,
  onConfirm,
  onOpenChange,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root
      open={open}
      disablePointerDismissal={busy}
      onOpenChange={(nextOpen, eventDetails) => {
        if (!nextOpen && busy) {
          eventDetails.cancel();
          return;
        }
        onOpenChange(nextOpen);
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="ui-backdrop fixed inset-0 z-[80]" />
        <Dialog.Viewport className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto p-4">
          <Dialog.Popup
            className="confirm-dialog-popup ui-popover w-full max-w-[28rem] overflow-hidden p-0 outline-none"
            initialFocus={cancelRef ?? confirmRef}
            finalFocus={returnFocusRef ? () => returnFocusRef.current?.isConnected ? returnFocusRef.current : true : undefined}
          >
            <div className="flex items-start gap-4 border-b border-border-control px-6 py-5">
              <div className="min-w-0 flex-1">
                <Dialog.Title className="[overflow-wrap:anywhere] text-xl font-semibold text-text-primary">
                  {title}
                </Dialog.Title>
                <Dialog.Description className="mt-1 [overflow-wrap:anywhere] text-sm leading-relaxed text-text-secondary">
                  {description}
                </Dialog.Description>
              </div>
              <Dialog.Close
                className={iconButtonClassName()}
                aria-label="Close"
                disabled={busy}
              >
                <CloseIcon />
              </Dialog.Close>
            </div>
            <div className="flex flex-col gap-4 px-6 py-5">
              {children}
              {error ? <p className="text-sm text-text-danger" role="alert">{error}</p> : null}
              <div className="flex flex-wrap justify-end gap-2">
                {busy && onCancelWhileBusy ? <Button onClick={onCancelWhileBusy} disabled={cancelPending}>
                  {cancelPending ? "Canceling…" : cancelLabel}
                </Button> : <Dialog.Close ref={cancelRef} className={buttonClassName()} disabled={busy}>
                  {cancelLabel}
                </Dialog.Close>}
                <Button ref={confirmRef} variant="danger" disabled={busy} onClick={onConfirm}>
                  {busy ? pendingLabel : confirmLabel}
                </Button>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
