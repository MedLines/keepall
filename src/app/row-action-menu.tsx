"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ContextMenu } from "@base-ui/react/context-menu";
import { Menu } from "@base-ui/react/menu";
import { useRef, useState, type ReactElement, type ReactNode, type RefObject } from "react";

/** Both opening methods use the same actions, with independent Base UI triggers. */
export function RowActionMenu({ children, trigger, menu, label, disabled, triggerRef, onOpen, finalFocus }: {
  children: (trigger: ReactNode) => ReactElement;
  trigger: ReactElement | null;
  menu: () => ReactNode;
  label: string;
  disabled?: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onOpen?: () => void;
  finalFocus?: Menu.Popup.Props["finalFocus"];
}) {
  const [contextOpen, setContextOpen] = useState(false);
  const [buttonOpen, setButtonOpen] = useState(false);
  const restoreContextFocus = useRef(true);
  const restoreButtonFocus = useRef(true);
  const popup = (align: "start" | "end", restoreFocus: RefObject<boolean>) => (
    <Menu.Portal>
      <Menu.Positioner align={align} sideOffset={4} collisionPadding={8} positionMethod="fixed" className="z-[60] data-[anchor-hidden]:invisible">
        <Menu.Popup
          aria-label={label}
          className="row-action-popup ui-menu-popup ui-popover flex max-h-[var(--available-height)] w-56 max-w-[calc(100vw-1rem)] flex-col overflow-hidden cursor-default outline-none"
          finalFocus={(interaction) => {
            if (!restoreFocus.current) return false;
            if (typeof finalFocus === "function") return finalFocus(interaction);
            if (typeof finalFocus === "boolean") return finalFocus;
            return (finalFocus ?? triggerRef).current;
          }}
        >
          <ScrollArea className="row-action-scroll flex min-h-0 flex-col" viewportClassName="min-h-0 flex-1">
            <RowMenuContent renderMenu={menu} />
          </ScrollArea>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );

  return (
    <ContextMenu.Root disabled={disabled} open={contextOpen} onOpenChange={(open, details) => {
      restoreContextFocus.current = !["outside-press", "focus-out", "sibling-open"].includes(details.reason);
      if (open) { restoreButtonFocus.current = false; setButtonOpen(false); onOpen?.(); }
      setContextOpen(open);
    }}>
      <ContextMenu.Trigger render={children(trigger ? (
        <Menu.Root modal={false} disabled={disabled} open={buttonOpen} onOpenChange={(open, details) => {
          restoreButtonFocus.current = !["outside-press", "focus-out", "sibling-open"].includes(details.reason);
          if (open) { restoreContextFocus.current = false; setContextOpen(false); onOpen?.(); }
          setButtonOpen(open);
        }}>
          <Menu.Trigger ref={triggerRef} render={trigger} />
          {popup("end", restoreButtonFocus)}
        </Menu.Root>
      ) : null)} />
      {popup("start", restoreContextFocus)}
    </ContextMenu.Root>
  );
}

function RowMenuContent({ renderMenu }: { renderMenu: () => ReactNode }) {
  return renderMenu();
}
