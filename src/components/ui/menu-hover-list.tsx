"use client";

import { motion, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { uiMotion } from "./motion-tokens";

type Highlight = { x: number; y: number; width: number; height: number };

/** Follow the primitive's highlight so pointer and keyboard keep the same target. */
export function MenuHoverList({ children }: { children: ReactNode }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const item = list.querySelector<HTMLElement>("[data-highlighted]");
      if (!item || !item.offsetWidth || !item.offsetHeight) return;
      const next = { x: item.offsetLeft, y: item.offsetTop, width: item.offsetWidth, height: item.offsetHeight };
      setHighlight(previous => previous?.x === next.x && previous.y === next.y && previous.width === next.width && previous.height === next.height ? previous : next);
    };
    function schedule() {
      if (!frame) frame = requestAnimationFrame(measure);
    }
    const mutations = new MutationObserver(schedule);
    mutations.observe(list, { attributes: true, subtree: true, childList: true, attributeFilter: ["data-highlighted"] });
    const resize = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
    resize?.observe(list);
    schedule();
    return () => {
      mutations.disconnect();
      resize?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={listRef} className="fluid-menu-list relative isolate flex flex-col gap-1" data-gliding-highlight={highlight ? "" : undefined}>
    {highlight ? <motion.span
      aria-hidden="true"
      className="fluid-menu-highlight pointer-events-none absolute left-0 top-0"
      initial={false}
      animate={{ x: highlight.x, y: highlight.y }}
      style={{ width: highlight.width, height: highlight.height }}
      transition={reduceMotion ? { duration: 0 } : uiMotion.fast}
    /> : null}
    {children}
  </div>;
}
