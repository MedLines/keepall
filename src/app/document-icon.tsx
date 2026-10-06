import type { DocumentFormat } from "@/domain/document";
import { MarkdownFileIcon, PdfIcon, TextFileIcon } from "./shell-icons";

export function DocumentIcon({ format, className = "size-4" }: { format: DocumentFormat; className?: string }) {
  const Icon = format === "pdf" ? PdfIcon : format === "markdown" ? MarkdownFileIcon : TextFileIcon;
  return <Icon className={`item-type-icon item-type-icon--${format} ${className}`} />;
}
