"use client";

import { ScrollArea as Primitive } from "@base-ui/react/scroll-area";
import type { ComponentPropsWithoutRef, Ref } from "react";
import { useTouchPrimary } from "@/hooks/use-touch-primary";
import { cn } from "@/lib/utils";
import { ScrollBar } from "./scroll-area";

/** Compose the registry track with a real viewport ref for virtualizers and media. */
export function ScrollPanel({ children, className, viewportClassName, contentClassName,
  viewportRef, viewportProps, orientation = "vertical", ...props }: ComponentPropsWithoutRef<"div"> & {
  viewportClassName?: string;
  contentClassName?: string;
  viewportRef?: Ref<HTMLDivElement>;
  viewportProps?: Omit<ComponentPropsWithoutRef<"div">, "children" | "className"> & { [key: `data-${string}`]: string | boolean | undefined };
  orientation?: "vertical" | "horizontal" | "both";
}) {
  const touch = useTouchPrimary();
  const rootClass = cn("relative overflow-hidden", className);
  const viewportClass = cn("size-full min-h-0 rounded-[inherit]", viewportClassName);
  return touch ? (
    <div {...props} data-slot="scroll-area" className={rootClass}>
      <div {...viewportProps} ref={viewportRef} data-slot="scroll-area-viewport" tabIndex={viewportProps?.tabIndex ?? 0}
        className={cn(viewportClass, orientation === "vertical" ? "overflow-y-auto" : orientation === "horizontal" ? "overflow-x-auto" : "overflow-auto")}>
        <div className={contentClassName}>{children}</div>
      </div>
    </div>
  ) : (
    <Primitive.Root {...props} data-slot="scroll-area" className={rootClass}>
      <Primitive.Viewport {...viewportProps} ref={viewportRef} data-slot="scroll-area-viewport" className={viewportClass}>
        <Primitive.Content className={contentClassName} style={orientation === "vertical" ? { minWidth: 0 } : undefined}>{children}</Primitive.Content>
      </Primitive.Viewport>
      {orientation !== "horizontal" ? <ScrollBar orientation="vertical" /> : null}
      {orientation !== "vertical" ? <ScrollBar orientation="horizontal" /> : null}
      {orientation === "both" ? <Primitive.Corner /> : null}
    </Primitive.Root>
  );
}
