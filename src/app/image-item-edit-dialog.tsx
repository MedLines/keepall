"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";
import type { ImageItem } from "@/domain/image";
import { CloseIcon } from "./shell-icons";

export type ImageDetailsDraft = {
  title: string;
  caption: string;
  sourceUrl: string;
};

type Props = {
  item: ImageItem;
  open: boolean;
  busy: boolean;
  error: string | null;
  onSave: (draft: ImageDetailsDraft) => void;
  onOpenChange: (open: boolean) => void;
};

export function ImageItemEditDialog({
  item,
  open,
  busy,
  error,
  onSave,
  onOpenChange,
}: Props) {
  const [title, setTitle] = useState(item.title);
  const [caption, setCaption] = useState(item.caption);
  const [sourceUrl, setSourceUrl] = useState(item.sourceUrl);

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
          <Dialog.Popup className="ui-popover flex max-h-[min(44rem,calc(100dvh-2rem))] w-full max-w-[42rem] flex-col overflow-hidden p-0 outline-none">
            <header className="flex shrink-0 items-start gap-4 border-b border-border-control px-5 py-5 sm:px-6">
              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-xl font-semibold text-text-primary">
                  Edit image details
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm leading-relaxed text-text-secondary">
                  Change the title, notes, or source. Gallery images stay unchanged.
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

            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(event) => {
                event.preventDefault();
                onSave({ title, caption, sourceUrl });
              }}
            >
              <div className="scroll-fade min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                <label className="grid gap-2 text-sm font-medium text-text-primary">
                  Title (optional)
                  <input
                    className="ui-field min-h-11 px-3 text-sm font-normal"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-text-primary">
                  Notes
                  <textarea
                    className="ui-field min-h-64 resize-y px-3 py-3 text-base font-normal leading-7"
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-text-primary">
                  Source URL (optional)
                  <input
                    className="ui-field min-h-11 px-3 text-sm font-normal"
                    inputMode="url"
                    value={sourceUrl}
                    onChange={(event) => setSourceUrl(event.target.value)}
                  />
                </label>
                {error ? (
                  <p className="text-sm text-text-danger" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>

              <footer className="flex shrink-0 justify-end gap-2 border-t border-border-control px-5 py-4 sm:px-6">
                <Dialog.Close
                  className="ui-control min-h-10 px-4 text-sm font-medium"
                  disabled={busy}
                >
                  Cancel
                </Dialog.Close>
                <button
                  className="ui-primary min-h-10 rounded-control-md px-4 text-sm font-medium disabled:opacity-60"
                  type="submit"
                  disabled={busy}
                >
                  {busy ? "Saving…" : "Save changes"}
                </button>
              </footer>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
