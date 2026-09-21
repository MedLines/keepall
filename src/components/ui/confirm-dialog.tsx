"use client";

import { Dialog } from "@base-ui/react/dialog";
import type { RefObject } from "react";
import { CloseIcon } from "@/app/shell-icons";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel?: string;
  busy?: boolean;
  error?: string | null;
  confirmRef?: RefObject<HTMLButtonElement | null>;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel = "Working…",
  busy = false,
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
            initialFocus={confirmRef}
          >
            <header className="flex items-start gap-4 border-b border-border-control px-6 py-5">
              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-xl font-semibold text-text-primary">
                  {title}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm leading-relaxed text-text-secondary">
                  {description}
                </Dialog.Description>
              </div>
              <Dialog.Close
                className="ui-control flex size-10 shrink-0 items-center justify-center"
                aria-label="Close"
                disabled={busy}
              >
                <CloseIcon />
              </Dialog.Close>
            </header>
            <div className="flex flex-col gap-4 px-6 py-5">
              {error ? <p className="text-sm text-text-danger" role="alert">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <Dialog.Close className="ui-control min-h-10 px-4 text-sm font-medium" disabled={busy}>
                  Cancel
                </Dialog.Close>
                <button
                  ref={confirmRef}
                  className="ui-control min-h-10 border-border-danger bg-bg-danger px-4 text-sm font-medium text-text-danger disabled:opacity-60"
                  type="button"
                  disabled={busy}
                  onClick={onConfirm}
                >
                  {busy ? pendingLabel : confirmLabel}
                </button>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
