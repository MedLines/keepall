import { Tooltip } from "@base-ui/react/tooltip";
import { NoteFormatControl } from "./note-format-control";
import { EditIcon, EyeIcon } from "./shell-icons";

type Props = {
  format: "plain" | "markdown";
  preview: boolean;
  disabled?: boolean;
  onFormatChange: (format: "plain" | "markdown") => void;
  onPreviewChange: (preview: boolean) => void;
};

export function NoteEditorControls({ format, preview, disabled = false, onFormatChange, onPreviewChange }: Props) {
  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
      <NoteFormatControl format={format} disabled={disabled} onChange={onFormatChange} />
      <Tooltip.Provider delay={350}>
        <div role="group" aria-label="Note editor view" data-selected={preview ? "end" : "start"} className="icon-segmented-switch squircle-panel relative isolate ms-auto flex h-11 shrink-0 rounded-control-lg bg-bg-raised p-0.5">
          <span aria-hidden="true" className="icon-segmented-thumb squircle-panel ui-selected pointer-events-none absolute left-0.5 top-0.5 h-10 w-[42px] rounded-control-sm" />
          {([
            { preview: false, label: "Edit", hint: "Edit notes", icon: <EditIcon /> },
            { preview: true, label: "Preview", hint: "Preview notes", icon: <EyeIcon /> },
          ] as const).map((option) => (
            <Tooltip.Root key={option.label}>
              <Tooltip.Trigger type="button" aria-label={option.label} aria-pressed={preview === option.preview} disabled={disabled}
                className={`squircle-panel relative flex size-10 w-[42px] items-center justify-center rounded-control-sm disabled:opacity-60 ${preview === option.preview ? "text-text-primary" : "text-text-secondary hover:text-text-primary"}`}
                onClick={() => onPreviewChange(option.preview)}>
                {option.icon}
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner side="top" sideOffset={8} className="z-[100]">
                  <Tooltip.Popup className="rounded-control-sm border border-border-control bg-bg-surface px-2.5 py-1.5 text-xs font-medium text-text-primary shadow-menu transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0">
                    {option.hint}
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          ))}
        </div>
      </Tooltip.Provider>
    </div>
  );
}
