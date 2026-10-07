"use client";

import { ContextMenu } from "@base-ui/react/context-menu";
import Link from "next/link";
import type { ReactElement } from "react";

export function LogoContextMenu({ children }: { children: ReactElement }) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger render={children} />
      <ContextMenu.Portal>
        <ContextMenu.Positioner sideOffset={4} collisionPadding={8} className="z-[60]">
          <ContextMenu.Popup aria-label="Keepall navigation" className="ui-menu-popup ui-popover w-48 outline-none">
            {[
              ["/about", "About"],
              ["/help", "Help"],
              ["/contact", "Contact"],
              ["/changelog", "Changelog"],
              ["/privacy", "Privacy"],
            ].map(([href, label]) => (
              <ContextMenu.LinkItem
                key={href}
                render={<Link href={href} />}
                closeOnClick
                className="ui-menu-item flex w-full text-sm text-text-primary data-[highlighted]:bg-bg-active"
              >
                {label}
              </ContextMenu.LinkItem>
            ))}
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
