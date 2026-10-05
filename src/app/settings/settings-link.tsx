import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRightIcon } from "../shell-icons";

export function SettingsLink({ href, children, primary = false }: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  const className = `ui-control inline-flex min-h-11 items-center justify-between gap-3 px-4 py-2 text-sm font-medium ${primary ? "ui-primary" : "text-text-primary"}`;
  const content = <>{children}<ArrowRightIcon className="size-4" /></>;
  return href.startsWith("#")
    ? <a href={href} className={className}>{content}</a>
    : <Link href={href} className={className}>{content}</Link>;
}
