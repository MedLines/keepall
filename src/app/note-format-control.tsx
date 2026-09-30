import { MarkdownIcon, PlainTextIcon } from "./shell-icons";

type Props = {
  format: "plain" | "markdown";
  disabled?: boolean;
  onChange: (format: "plain" | "markdown") => void;
};

export function NoteFormatControl({ format, disabled = false, onChange }: Props) {
  return (
    <div role="group" aria-label="Note format" data-selected={format === "markdown" ? "end" : "start"} className="icon-segmented-switch squircle-panel relative isolate flex h-11 w-60 shrink-0 rounded-control-lg bg-bg-raised p-0.5">
      <span aria-hidden="true" className="icon-segmented-thumb squircle-panel ui-selected pointer-events-none absolute left-0.5 top-0.5 h-10 w-[calc(50%_-_2px)] rounded-control-sm" />
      {(["plain", "markdown"] as const).map((choice) => (
        <button
          key={choice}
          type="button"
          aria-pressed={format === choice}
          disabled={disabled}
          className={`squircle-panel relative flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-control-sm px-2 text-xs font-medium disabled:opacity-60 ${format === choice ? "text-text-primary" : "text-text-secondary hover:text-text-primary"}`}
          onClick={() => onChange(choice)}
        >
          {choice === "plain" ? <PlainTextIcon /> : <MarkdownIcon />}
          {choice === "plain" ? "Plain text" : "Markdown"}
        </button>
      ))}
    </div>
  );
}
