import type { DocumentFormat } from "@/domain/document";
import { MarkdownFileIcon, PdfIcon, TextFileIcon } from "./shell-icons";

/**
 * File glyph for PDF, TXT and MD documents, with the extension drawn into it.
 *
 * @import import { DocumentIcon } from "@/app/document-icon";
 */
export function DocumentIcon({ format, className = "size-4" }: { format: DocumentFormat; className?: string }) {
  const Icon = format === "pdf" ? PdfIcon : format === "markdown" ? MarkdownFileIcon : TextFileIcon;
  return <Icon className={`item-type-icon item-type-icon--${format} ${className}`} />;
}
