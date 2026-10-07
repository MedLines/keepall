"use client";

import { useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";

const decoded = new Set<string>();
function rememberDecoded(src: string) {
  decoded.delete(src);
  decoded.add(src);
  while (decoded.size > 64) decoded.delete(decoded.values().next().value!);
}

/** Fade cold thumbnails once; cached images stay visible when rows remount. */
export function LibraryThumbnailImage({ src, alt = "", animate = true, className = "", onLoad, ...props }: ComponentPropsWithoutRef<"img"> & { src: string; animate?: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(() => decoded.has(src) ? src : null);
  useLayoutEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) {
      rememberDecoded(src);
      setLoadedSrc(src);
    }
  }, [src]);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local library thumbnails and favicon sources
    <img {...props} ref={ref} src={src} alt={alt} className={`${animate ? "library-thumbnail-image" : ""} ${className}`}
      data-ready={!animate || loadedSrc === src || decoded.has(src)} onLoad={event => {
        rememberDecoded(src);
        setLoadedSrc(src);
        onLoad?.(event);
      }} />
  );
}
