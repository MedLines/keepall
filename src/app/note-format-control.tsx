type Props = {
  format: "plain" | "markdown";
  disabled?: boolean;
  onChange: (format: "plain" | "markdown") => void;
};

export function NoteFormatControl({ format, disabled = false, onChange }: Props) {
  return (
    <div role="group" aria-label="Note format" className="flex items-center gap-1">
      {(["plain", "markdown"] as const).map((choice) => (
        <button
          key={choice}
          type="button"
          aria-pressed={format === choice}
          disabled={disabled}
          className={`ui-control min-h-9 px-3 text-xs font-medium ${format === choice ? "ui-selected text-text-primary" : ""}`}
          onClick={() => onChange(choice)}
        >
          {choice === "plain" ? "Plain text" : "Markdown"}
        </button>
      ))}
    </div>
  );
}
