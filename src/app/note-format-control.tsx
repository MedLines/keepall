import { MarkdownIcon, PlainTextIcon } from "./shell-icons";
import { SegmentedControl } from "./segmented-control";

type Props = {
  format: "plain" | "markdown";
  disabled?: boolean;
  onChange: (format: "plain" | "markdown") => void;
};

export function NoteFormatControl({ format, disabled = false, onChange }: Props) {
  return <SegmentedControl label="Note format" value={format} disabled={disabled} onChange={onChange} className="w-60"
    choices={[
      { value: "plain", label: "Plain text", icon: <PlainTextIcon /> },
      { value: "markdown", label: "Markdown", icon: <MarkdownIcon /> },
    ]} />;
}
