"use client";

import type { ReactNode } from "react";
import { useId } from "react";
import { SideDrawer } from "@/components/ui/side-drawer";
import { CloseIcon, CollectionIcon, HashIcon } from "./shell-icons";

export function OrganizerTagChip({ name, disabled, onRemove, removeLabel = `Remove tag ${name}` }: {
  name: string;
  disabled: boolean;
  onRemove: () => void;
  removeLabel?: string;
}) {
  return <li className="control-squircle flex min-h-10 items-center gap-1 rounded-control bg-bg-raised ps-3 text-sm">
    <span>{name}</span>
    <button type="button" aria-label={removeLabel} disabled={disabled} onClick={onRemove}
      className="flex size-10 items-center justify-center rounded-control text-text-secondary transition-colors hover:bg-bg-danger hover:text-text-danger"
    ><CloseIcon className="size-4" /></button>
  </li>;
}

export function OrganizerDrawer({
  open, onOpenChange, side, title, description, disabled, tags, collection, error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: "left" | "right";
  title: string;
  description: string;
  disabled: boolean;
  tags: ReactNode;
  collection: ReactNode;
  error?: string | null;
}) {
  const id = useId();
  return (
    <SideDrawer
      open={open} side={side} title={title} description={description}
      closeDisabled={disabled}
      onOpenChange={(nextOpen, details) => {
        if (!nextOpen && disabled) { details.cancel(); return; }
        onOpenChange(nextOpen);
      }}
    >
      <div className="ui-scrollbar scroll-fade min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
        <div className="flex flex-col gap-8">
          <section aria-labelledby={`${id}-collection`}>
            <div className="mb-3 flex items-center gap-2">
              <CollectionIcon className="size-5" />
              <h3 id={`${id}-collection`} className="font-medium">Collection</h3>
            </div>
            {collection}
          </section>
          <section aria-labelledby={`${id}-tags`}>
            <div className="mb-3 flex items-center gap-2">
              <HashIcon className="size-5" />
              <h3 id={`${id}-tags`} className="font-medium">Tags</h3>
            </div>
            {tags}
          </section>
          {error ? <p role="alert" className="text-sm text-text-danger">{error}</p> : null}
        </div>
      </div>
      <footer className="shrink-0 border-t border-border-control px-5 py-4">
        <button type="button" className="ui-primary min-h-10 w-full px-4 text-sm font-medium disabled:opacity-60" disabled={disabled} onClick={() => onOpenChange(false)}>Done</button>
      </footer>
    </SideDrawer>
  );
}
