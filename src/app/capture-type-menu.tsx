"use client";

import { Menu } from "@base-ui/react/menu";
import { ChevronDownIcon, LinkIcon, NoteIcon, SelectionCheckedIcon } from "./shell-icons";

type Props = {
  value: "link" | "note";
  disabled: boolean;
  onChange: (value: "link" | "note") => void;
};

export function CaptureTypeMenu({ value, disabled, onChange }: Props) {
  return (
    <Menu.Root modal={false} disabled={disabled}>
      <Menu.Trigger className="ui-control flex size-8 shrink-0 items-center justify-center disabled:opacity-60" aria-label="Change type" title="Change type">
        <ChevronDownIcon className="size-4" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={4} collisionPadding={8} positionMethod="fixed" className="z-[80] data-[anchor-hidden]:invisible">
          <Menu.Popup aria-label="Save as" className="ui-popover w-44 max-w-[calc(100vw-1rem)] outline-none">
            <Menu.RadioGroup value={value} onValueChange={(next) => {
              if (next === "link" || next === "note") onChange(next);
            }}>
              {(["link", "note"] as const).map((type) => (
                <Menu.RadioItem key={type} value={type} closeOnClick
                  className="ui-menu-item flex items-center gap-2 text-sm outline-none data-[highlighted]:bg-bg-active data-[disabled]:opacity-50">
                  {type === "link" ? <LinkIcon className="size-4" /> : <NoteIcon className="size-4" />}
                  <span>Save as {type}</span>
                  <Menu.RadioItemIndicator className="ml-auto"><SelectionCheckedIcon className="size-4" /></Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
