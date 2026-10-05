"use client";

import { useEffect, useRef, type RefObject } from "react";
import { NoteEditorControls } from "./note-editor-controls";
import { NoteContent } from "./note-content";
import { ImagesIcon, GridIcon } from "./shell-icons";

/* ANIMATION STORYBOARD
 *   0ms  a layout choice swaps layers in the same reserved space
 * 150ms  opacity settles and the incoming layer moves 4px → 0
 *        thumbnails, Add files and organization controls stay in place
 */
const TIMING = { swap: 150 }; // interruptible interaction, no delayed stages
const PANEL = { offsetY: 4, easing: "cubic-bezier(0.2, 0, 0, 1)" };
const OPTIONS = [
  ["gallery", "One image item", "Keep these images together in a gallery."],
  ["separate", "Separate image items", "Save each image as its own library item."],
] as const;

type Props = {
  mode: "gallery" | "separate" | null;
  disabled: boolean;
  value: string;
  format: "plain" | "markdown";
  preview: boolean;
  label: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onModeChange: (mode: "gallery" | "separate" | null) => void;
  onChange: (value: string) => void;
  onFormatChange: (format: "plain" | "markdown") => void;
  onPreviewChange: (preview: boolean) => void;
};

export function CaptureImageLayout({ mode, disabled, value, format, preview, label, inputRef, onModeChange, onChange, onFormatChange, onPreviewChange }: Props) {
  const stage = mode === "gallery" ? 1 : 0;
  const choiceRef = useRef<HTMLInputElement>(null);
  const focusFrame = useRef<number | null>(null);
  useEffect(() => () => { if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current); }, []);

  function changeMode(next: Props["mode"]) {
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    onModeChange(next);
    if (next !== "separate") focusFrame.current = requestAnimationFrame(() => {
      (next === "gallery" ? inputRef.current : choiceRef.current)?.focus();
    });
  }

  function layer(active: boolean) {
    return {
      opacity: active ? 1 : 0,
      transform: `translateY(${active ? "0px" : `var(--capture-offset-y, ${PANEL.offsetY}px)`})`,
      transition: `opacity var(--capture-swap-duration, ${TIMING.swap}ms) ${PANEL.easing}, transform var(--capture-swap-duration, ${TIMING.swap}ms) ${PANEL.easing}`,
    };
  }

  return <div className="capture-image-layout relative h-56 shrink-0" data-testid="capture-image-layout-slot">
    <fieldset className={`absolute inset-0 flex flex-col gap-2 ${stage === 1 ? "pointer-events-none" : ""}`} disabled={disabled}
      aria-hidden={stage === 1} inert={stage === 1} style={layer(stage === 0)}>
      <legend className="mb-2 text-sm font-medium">Save images as</legend>
      {OPTIONS.map(([option, title, description]) => <label key={option} className={`ui-field flex min-h-16 cursor-pointer items-start gap-3 p-3 ${mode === option ? "border-action-primary" : ""}`}>
        <input ref={option === "gallery" ? choiceRef : undefined} type="radio" name="capture-image-layout" checked={mode === option}
          onChange={() => changeMode(option)} className="mt-1 size-4 shrink-0 accent-action-primary" />
        {option === "gallery" ? <ImagesIcon className="mt-0.5 shrink-0 text-text-secondary" /> : <GridIcon className="mt-0.5 shrink-0 text-text-secondary" />}
        <span><span className="block text-sm font-medium">{title}</span><span className="mt-1 block text-xs text-text-secondary">{description}</span></span>
      </label>)}
    </fieldset>
    <div className={`absolute inset-0 flex min-h-0 flex-col gap-2 ${stage === 0 ? "pointer-events-none" : ""}`}
      aria-hidden={stage === 0} inert={stage === 0} style={layer(stage === 1)}>
      <div className="flex min-h-8 items-center justify-between gap-2">
        <label htmlFor="capture-image-caption" className="text-sm font-medium">Caption (optional)</label>
        <button type="button" className="ui-control min-h-8 shrink-0 px-2 text-xs" disabled={disabled} onClick={() => changeMode(null)}>Change image layout</button>
      </div>
      <NoteEditorControls format={format} preview={preview} disabled={disabled} onFormatChange={onFormatChange} onPreviewChange={onPreviewChange} />
      {preview ? <section aria-label="Image note preview" className="ui-field min-h-0 flex-1 overflow-y-auto rounded-input p-3"><NoteContent content={value} format={format} /></section>
        : <textarea ref={inputRef} id="capture-image-caption" aria-label={label} className="ui-field min-h-0 flex-1 resize-none rounded-input px-4 py-3 text-sm disabled:opacity-60"
          placeholder="Optional source URL or caption" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />}
    </div>
  </div>;
}
