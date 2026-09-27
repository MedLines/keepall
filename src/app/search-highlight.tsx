"use client";

import { Fragment, useLayoutEffect, useRef, type ReactNode } from "react";
import { createSearchExcerpt, findSearchMatches, findTextMatches } from "@/domain/search";
import type { Item } from "@/domain/item";

export function SearchHighlight({ text, query = "" }: { text: string; query?: string }) {
  const ranges = findTextMatches(text, query);
  if (!ranges.length) return text;
  return <>{ranges.map((range, index) => (
    <Fragment key={range.start}>
      {text.slice(index ? ranges[index - 1].end : 0, range.start)}
      <mark className="search-highlight">{text.slice(range.start, range.end)}</mark>
    </Fragment>
  ))}{text.slice(ranges[ranges.length - 1].end)}</>;
}

function hasUnclippedMatch(content: HTMLElement): boolean {
  return Array.from(content.querySelectorAll("mark.search-highlight")).some(mark => {
    const rects = Array.from(mark.getClientRects());
    if (!rects.length || !rects.some(rect => rect.width && rect.height)) return false;
    for (let parent = mark.parentElement; parent && parent !== content; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      const bounds = parent.getBoundingClientRect();
      const clipsX = style.overflowX !== "visible";
      const clipsY = style.overflowY !== "visible";
      if (rects.some(rect => (clipsX && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)) ||
          (clipsY && (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)))) return false;
    }
    return true;
  });
}

export function SearchResult({ item, query = "", tagNames = [], children }: {
  item: Item;
  query?: string;
  tagNames?: readonly string[];
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const excerptRef = useRef<HTMLParagraphElement>(null);
  const match = findSearchMatches(item, query, tagNames)[0];

  useLayoutEffect(() => {
    const content = contentRef.current;
    const excerpt = excerptRef.current;
    if (!content || !excerpt) return;
    // Size-dependent presentation only; update before paint without a second React render.
    const measure = () => { excerpt.hidden = hasUnclippedMatch(content); };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [children, query, match?.text]);

  return <>
    <div ref={contentRef} className="min-w-0">{children}</div>
    {match ? <p ref={excerptRef} className="search-excerpt mt-2 break-words text-sm leading-6 text-text-secondary [overflow-wrap:anywhere]">
      <span className="font-medium">{match.label}: </span>
      <SearchHighlight text={createSearchExcerpt(match.text, query)} query={query} />
    </p> : null}
  </>;
}
