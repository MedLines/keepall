import { SegmentedControl } from "@/components/ui/segmented-control";
import { NoteFormatControl } from "./note-format-control";
import { EditIcon, EyeIcon } from "./shell-icons";

type Props = {
  format: "plain" | "markdown";
  preview: boolean;
  disabled?: boolean;
  formatDisabled?: boolean;
  portalContainer?: HTMLElement | ShadowRoot | null;
  onFormatChange: (format: "plain" | "markdown") => void;
  onPreviewChange: (preview: boolean) => void;
};

export function NoteEditorControls({ format, preview, disabled = false, formatDisabled = disabled, portalContainer, onFormatChange, onPreviewChange }: Props) {
  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
      <NoteFormatControl format={format} disabled={disabled || formatDisabled} onChange={onFormatChange} />
      <SegmentedControl
        variant="icon"
        label="Note editor view"
        className="ms-auto"
        value={preview ? "preview" : "edit"}
        disabled={disabled}
        tooltipSide="top"
        tooltipContainer={portalContainer}
        onChange={value => onPreviewChange(value === "preview")}
        choices={[
          { value: "edit", ariaLabel: "Edit", icon: <EditIcon />, tooltip: "Edit notes" },
          { value: "preview", ariaLabel: "Preview", icon: <EyeIcon />, tooltip: "Preview notes" },
        ]}
      />
    </div>
  );
}
