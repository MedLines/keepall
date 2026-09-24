import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  href: string;
  children: ReactNode;
  external?: boolean;
  wide?: boolean;
};

export function ItemDetailLink({ href, children, external = false, wide = false }: Props) {
  const hitAreaClass = `group outline-none ${wide ? "flex w-full" : "inline-flex"}`;
  const face = (
    <span className={`ui-control pointer-events-none inline-flex items-center px-3 text-sm group-hover:bg-bg-raised group-hover:text-text-primary group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-border-focus ${wide ? "min-h-11 w-full justify-center font-medium" : "min-h-9"}`}>
      {children}
    </span>
  );

  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={hitAreaClass}>{face}</a>
  ) : (
    <Link href={href} className={hitAreaClass}>{face}</Link>
  );
}
