"use client";

import { ContextMenu } from "@base-ui/react/context-menu";
import Link from "next/link";
import type { ReactElement } from "react";
import { menuItemClassName } from "@/components/ui/menu-item";
import { useTranslations } from "@/i18n/use-translations";

const LINKS = [
  ["/about", "about"],
  ["/help", "help"],
  ["/contact", "contact"],
  ["/changelog", "changelog"],
  ["/privacy", "privacy"],
] as const;

export function LogoContextMenu({ children }: { children: ReactElement }) {
  const t = useTranslations("LogoMenu");
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger render={children} />
      <ContextMenu.Portal>
        <ContextMenu.Positioner sideOffset={4} collisionPadding={8} className="z-[60]">
          <ContextMenu.Popup aria-label={t("label")} className="ui-menu-popup ui-popover w-48 outline-none">
            {LINKS.map(([href, key]) => (
              <ContextMenu.LinkItem
                key={href}
                render={<Link href={href} />}
                closeOnClick
                className={menuItemClassName({ layout: "none" })}
              >
                {t(key)}
              </ContextMenu.LinkItem>
            ))}
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
