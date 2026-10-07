"use client";

import Link from "next/link";
import { Tooltip } from "@base-ui/react/tooltip";
import { ContextMenu } from "@base-ui/react/context-menu";
import { motion, useReducedMotion } from "motion/react";
import { useId, useState, type ReactNode } from "react";
import { ScrollPanel } from "@/components/ui/scroll-panel";
import type { ImageAnalysis } from "@/domain/image-analysis";
import { CheckIcon, ChevronDownIcon, CopyIcon, OcrIcon, PaletteIcon, SearchIcon } from "./shell-icons";
import { SHELL_TOOLTIP } from "./shell-styles";
import styles from "./image-tools-panel.module.css";

function swatchTextColor(hex: string) {
  const rgb = [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const blackContrast = (luminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (luminance + 0.05);
  return blackContrast >= whiteContrast ? "#000000" : "#FFFFFF";
}

function ResultSection({ title, icon, action, children }: {
  title: string; icon: ReactNode; action?: ReactNode; children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const contentId = useId();
  return <div className="library-panel squircle-panel min-w-0 rounded-panel border border-border-control bg-bg-image-viewer p-4 sm:p-5">
    <div className="flex items-center gap-2">
      <h2 className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-text-primary">{icon}<span>{title}</span></h2>
      {action}
      <button type="button" aria-label={title} title={`${expanded ? "Collapse" : "Expand"} ${title}`} aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(value => !value)} className={styles.sectionToggle}>
        <ChevronDownIcon className={`size-4 ${expanded ? "" : "-rotate-90"}`} />
      </button>
    </div>
    <div id={contentId} hidden={!expanded} className="space-y-3 pt-2">{children}</div>
  </div>;
}

function CopyFeedback({ copied }: { copied: boolean }) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : { type: "spring" as const, duration: 0.3, bounce: 0 };
  const visible = { opacity: 1, scale: 1, filter: "blur(0px)" };
  const hidden = { opacity: 0, scale: 1, filter: "blur(0px)" };
  const exiting = { opacity: 0, scale: reduceMotion ? 1 : 0.25, filter: reduceMotion ? "blur(0px)" : "blur(4px)" };
  return <span aria-hidden="true" data-copy-feedback data-copied={copied} className="relative block size-4">
    <motion.span data-copy-icon="copy" initial={false} animate={copied ? exiting : visible} transition={transition} className="absolute inset-0"><CopyIcon className="size-4" /></motion.span>
    <motion.span data-copy-icon="check" initial={false} animate={copied ? visible : hidden} transition={transition} className="absolute inset-0"><CheckIcon className="size-4" /></motion.span>
  </span>;
}

export function PaletteSection({ palette, copied, onCopy, allowLibrarySearch = true, portalContainer }: {
  palette: string[];
  allowLibrarySearch?: boolean;
  portalContainer?: HTMLElement | null;
  copied: string | null;
  onCopy: (value: string, key: string) => void;
}) {
  return <ResultSection title="Palette" icon={<PaletteIcon className="size-4" />}>
    {palette.length ? <Tooltip.Provider delay={250}>
        <ul className={styles.palette} aria-label="Image colors">
          {palette.map(hex => <li key={hex}><PaletteSwatch portalContainer={portalContainer} allowLibrarySearch={allowLibrarySearch} hex={hex} copied={copied === hex} onCopy={() => onCopy(hex, hex)} /></li>)}
        </ul>
      </Tooltip.Provider> : <p className="text-sm text-text-secondary">No opaque colors found.</p>}
  </ResultSection>;
}

function PaletteSwatch({ hex, copied, onCopy, allowLibrarySearch, portalContainer }: { hex: string; copied: boolean; onCopy: () => void; allowLibrarySearch: boolean; portalContainer?: HTMLElement | null }) {
  const menuItem = "ui-menu-item flex w-full items-center gap-2 text-left text-sm text-text-primary outline-none data-[highlighted]:bg-bg-active";
  return <ContextMenu.Root>
    <Tooltip.Root>
      <Tooltip.Trigger render={<ContextMenu.Trigger render={<button type="button" />} onKeyDown={event => {
        if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
        event.preventDefault();
        const bounds = event.currentTarget.getBoundingClientRect();
        event.currentTarget.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: bounds.left + bounds.width / 2, clientY: bounds.bottom }));
      }} />} className={`ui-control ${styles.swatch}`} style={{ backgroundColor: hex, color: swatchTextColor(hex) }} aria-label={`Copy color ${hex}`} onClick={onCopy}>
        <span className="font-mono text-xs tabular-nums">{hex}</span>
        <span className={styles.swatchFeedback} data-copied={copied}><CopyFeedback copied={copied} /></span>
      </Tooltip.Trigger>
      <Tooltip.Portal container={portalContainer}><Tooltip.Positioner side="top" sideOffset={8} className="z-[100]"><Tooltip.Popup className={SHELL_TOOLTIP}>{hex}</Tooltip.Popup></Tooltip.Positioner></Tooltip.Portal>
    </Tooltip.Root>
    <ContextMenu.Portal container={portalContainer}>
      <ContextMenu.Positioner sideOffset={4} collisionPadding={8} positionMethod="fixed" className="z-[60]">
        <ContextMenu.Popup aria-label={`Color ${hex}`} className="ui-menu-popup ui-popover w-72 max-w-[calc(100vw-1rem)] outline-none">
          <ContextMenu.Group>
            <ContextMenu.GroupLabel className="px-3 py-2 text-xs text-text-secondary">{hex}</ContextMenu.GroupLabel>
            <ContextMenu.Item className={menuItem} onClick={onCopy}><CopyIcon className="size-4" />Copy color</ContextMenu.Item>
            {allowLibrarySearch ? <ContextMenu.LinkItem closeOnClick render={<Link href={`/?q=${encodeURIComponent(`color:${hex}`)}`} />} className={menuItem}><SearchIcon className="size-4" />Search library for nearby colors</ContextMenu.LinkItem> : null}
          </ContextMenu.Group>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  </ContextMenu.Root>;
}

export function ScreenshotTextSection({ ocr, slide, copied, onCopy }: {
  ocr: NonNullable<ImageAnalysis["ocr"]>;
  slide: number;
  copied: boolean;
  onCopy: (value: string, key: string) => void;
}) {
  return <ResultSection title="Screenshot text" icon={<OcrIcon className="size-4" />} action={ocr.text ? <button type="button" className="ui-control flex size-11 shrink-0 items-center justify-center" aria-label="Copy text" title="Copy text" onClick={() => onCopy(ocr.text, "ocr")}><CopyFeedback copied={copied} /></button> : null}>
    <p className="text-xs text-text-secondary" title="Recognized text may contain mistakes.">English · {Math.round(ocr.confidence)}% confidence</p>
    {ocr.text ? <ScrollPanel role="region" aria-label={`Extracted text from image ${slide + 1}`} className={styles.text} viewportClassName="max-h-64 px-4 py-3" viewportProps={{ tabIndex: 0 }}>
      <p className="select-text whitespace-pre-wrap break-words text-sm leading-6 text-text-primary [overflow-wrap:anywhere]">{ocr.text}</p>
    </ScrollPanel> : <p className="text-sm text-text-secondary">No text found. Try a sharper image or a closer crop.</p>}
  </ResultSection>;
}

