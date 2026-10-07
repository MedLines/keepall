"use client";

import { Menu } from "@base-ui/react/menu";
import { useRef } from "react";
import { useImageToolActions } from "./image-tools-panel";
import { CloseIcon, DeleteIcon, ImageIcon, MoreIcon, PaletteIcon, PlainTextIcon, RefreshIcon } from "./shell-icons";

export function CurrentImageMenu({ busy, canRemove, onReplace, onRemove, label = "Current image actions" }: {
  busy: boolean;
  canRemove: boolean;
  onReplace: () => void;
  onRemove: () => void;
  label?: string;
}) {
  const openingDialog = useRef(false);
  const tools = useImageToolActions();
  return (
    <Menu.Root modal={false} onOpenChange={(open) => { if (open) openingDialog.current = false; }}>
      <Menu.Trigger className="ui-control pointer-events-auto flex size-11 items-center justify-center bg-bg-surface disabled:opacity-60" aria-label={label} title={label} disabled={busy}>
        <MoreIcon />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={4} collisionPadding={8} positionMethod="fixed" className="z-[60] data-[anchor-hidden]:invisible">
          <Menu.Popup aria-label={label} className="ui-menu-popup ui-popover w-56 max-w-[calc(100vw-1rem)] outline-none" finalFocus={() => openingDialog.current ? false : true}>
            <Menu.Item className="ui-menu-item flex w-full items-center gap-2 text-left text-sm text-text-primary outline-none data-[highlighted]:bg-bg-active data-[disabled]:opacity-50" disabled={busy || tools.disabled} onClick={tools.onPalette}>
              <PaletteIcon />{tools.paletteLabel}
            </Menu.Item>
            <Menu.Item className="ui-menu-item flex w-full items-center gap-2 text-left text-sm text-text-primary outline-none data-[highlighted]:bg-bg-active data-[disabled]:opacity-50" disabled={busy || tools.disabled} title="English · first use needs a connection" onClick={tools.onReadText}>
              <PlainTextIcon />{tools.textLabel}
            </Menu.Item>
            {tools.retryLabel ? <Menu.Item className="ui-menu-item flex w-full items-center gap-2 text-left text-sm text-text-primary outline-none data-[highlighted]:bg-bg-active data-[disabled]:opacity-50" disabled={busy || tools.disabled} onClick={tools.onRetry}>
              <RefreshIcon />{tools.retryLabel}
            </Menu.Item> : null}
            {tools.running ? <Menu.Item className="ui-menu-item flex w-full items-center gap-2 text-left text-sm text-text-primary outline-none data-[highlighted]:bg-bg-active" onClick={tools.onCancel}>
              <CloseIcon />Cancel analysis
            </Menu.Item> : null}
            <Menu.Separator className="my-1 border-t border-border-edge" />
            <Menu.Item className="ui-menu-item flex w-full items-center gap-2 text-left text-sm text-text-primary outline-none data-[highlighted]:bg-bg-active data-[disabled]:opacity-50" disabled={busy || tools.running} onClick={onReplace}>
              <ImageIcon />Replace current image
            </Menu.Item>
            {canRemove ? (
              <>
                <Menu.Separator className="my-1 border-t border-border-edge" />
                <Menu.Item className="ui-menu-item flex w-full items-center gap-2 text-left text-sm text-text-danger outline-none data-[highlighted]:bg-bg-danger data-[disabled]:opacity-50" disabled={busy || tools.running} onClick={() => { openingDialog.current = true; onRemove(); }}>
                  <DeleteIcon />Remove current image
                </Menu.Item>
              </>
            ) : null}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

