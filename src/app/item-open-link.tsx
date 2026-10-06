"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/** Fully prepare only the viewer links the user is approaching. */
export function ItemOpenLink(props: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [intent, setIntent] = useState(false);
  const prepare = () => {
    setIntent(true);
  };
  return <Link {...props} prefetch={intent}
    onPointerEnter={event => { prepare(); props.onPointerEnter?.(event); }}
    onFocus={event => { prepare(); props.onFocus?.(event); }}
    onTouchStart={event => { prepare(); props.onTouchStart?.(event); }}
  />;
}
