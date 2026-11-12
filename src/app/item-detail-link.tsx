import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClassName } from "@/components/ui/button";

type Props = {
  href: string;
  children: ReactNode;
  external?: boolean;
  wide?: boolean;
};

export function ItemDetailLink({ href, children, external = false, wide = false }: Props) {
  const hitAreaClass = `group outline-none ${wide ? "flex w-full" : "inline-flex"}`;
  const face = (
    <span className={buttonClassName({ size: "none", className: `pointer-events-none px-3 text-sm group-hover:bg-bg-raised group-hover:text-text-primary group-focus-visible:outline-1 group-focus-visible:outline-offset-2 group-focus-visible:outline-border-focus ${wide ? "min-h-11 w-full justify-center font-medium" : "min-h-9 justify-start"}` })}>
      {children}
    </span>
  );

  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={hitAreaClass}>{face}</a>
  ) : (
    <Link href={href} className={hitAreaClass}>{face}</Link>
  );
}
