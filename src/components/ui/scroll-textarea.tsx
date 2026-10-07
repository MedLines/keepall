"use client";

import { ScrollArea as Primitive } from "@base-ui/react/scroll-area";
import { useCallback, useLayoutEffect, useRef, type ComponentProps } from "react";
import { useTouchPrimary } from "@/hooks/use-touch-primary";
import { cn } from "@/lib/utils";
import { ScrollBar } from "./scroll-area";

/** Keep native text editing, selection and caret scrolling inside the shared track. */
export function ScrollTextarea({ className, ref, style, value, defaultValue, ...props }: ComponentProps<"textarea">) {
  const field = useRef<HTMLTextAreaElement | null>(null);
  const touch = useTouchPrimary();
  const fieldRef = useCallback((node: HTMLTextAreaElement | null) => {
    field.current = node;
    if (typeof ref === "function") return ref(node);
    if (ref) ref.current = node;
  }, [ref]);

  useLayoutEffect(() => {
    // Changing textarea contents doesn't resize its box. Refresh Base UI's geometry.
    if (!touch) field.current?.dispatchEvent(new Event("scroll"));
  }, [value, defaultValue, touch]);

  const rootClass = cn("scroll-textarea relative grid min-w-0 grid-rows-[minmax(0,1fr)] overflow-hidden", className);
  const textarea = <textarea {...props} ref={fieldRef} value={value} defaultValue={defaultValue}
    className="size-full min-h-0 min-w-0 resize-none border-0 bg-transparent p-0 text-inherit outline-none" />;

  return touch ? (
    <div className={rootClass} style={style} data-disabled={props.disabled || undefined}>
      {textarea}
    </div>
  ) : (
    <Primitive.Root className={rootClass} style={style} data-disabled={props.disabled || undefined}>
      <Primitive.Viewport render={textarea} role="textbox" tabIndex={props.tabIndex ?? 0} />
      <ScrollBar orientation="vertical" />
    </Primitive.Root>
  );
}
