import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRightIcon } from "../shell-icons";
import { buttonClassName } from "@/components/ui/button";

/**
 * Full-width link row with a trailing arrow that leads to another settings section or page.
 *
 * @import import { SettingsLink } from "@/app/settings/settings-link";
 */
export function SettingsLink({ href, children, primary = false }: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  const className = buttonClassName({ variant: primary ? "primary" : "secondary", size: "lg", className: `justify-between gap-3 py-2 ${primary ? "" : "text-text-primary"}` });
  const content = <><span>{children}</span><ArrowRightIcon className="size-4" /></>;
  return href.startsWith("#")
    ? <a href={href} className={className}>{content}</a>
    : <Link href={href} className={className}>{content}</Link>;
}
