import { MarkdownIcon, PlainTextIcon } from "./shell-icons";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useTranslations } from "@/i18n/use-translations";

type Props = {
  format: "plain" | "markdown";
  disabled?: boolean;
  onChange: (format: "plain" | "markdown") => void;
};

export function NoteFormatControl({ format, disabled = false, onChange }: Props) {
  const t = useTranslations("NoteEditor");
  return <SegmentedControl label={t("format")} value={format} disabled={disabled} onChange={onChange} className="w-60"
    choices={[
      { value: "plain", label: t("plain"), icon: <PlainTextIcon /> },
      { value: "markdown", label: t("markdown"), icon: <MarkdownIcon /> },
    ]} />;
}
