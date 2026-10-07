import type { Item } from "@/domain/item";
import { DocumentIcon } from "./document-icon";
import { ImageIcon, ImagesIcon, LinkIcon, NoteIcon, VideoIcon } from "./shell-icons";

const typeLabels = { pdf: "PDF document", markdown: "Markdown document", text: "Text document", image: "Image", link: "Link", video: "Video", note: "Note" };

export function ItemTypeIcon({ item, className = "size-5" }: { item: Item; className?: string }) {
  const kind = item.type === "document" || (item.type === "note" && item.format === "markdown") ? item.format : item.type;
  const iconClassName = `item-type-icon item-type-icon--${kind} ${className}`;
  if (item.type === "document") return <DocumentIcon format={item.format} className={iconClassName} />;
  if (item.type === "note" && item.format === "markdown") return <DocumentIcon format="markdown" className={iconClassName} />;
  const Icon = item.type === "image" ? item.assetIds.length > 1 ? ImagesIcon : ImageIcon
    : item.type === "link" ? LinkIcon : item.type === "video" ? VideoIcon : NoteIcon;
  return <Icon className={iconClassName} />;
}

/** One colored identity glyph; only gallery counts add text. */
export function ItemTypeBadge({ item, variant = "card" }: { item: Item; variant?: "card" | "list" }) {
  const count = item.type === "image" && item.assetIds.length > 1 ? item.assetIds.length : null;
  const label = count ? `${count} images` : item.type === "note" && item.format === "markdown" ? "Markdown note" : typeLabels[item.type === "document" ? item.format : item.type];
  return <span className={variant === "list" ? "library-list-type-icon pointer-events-none inline-flex shrink-0 items-center gap-1 text-xs tabular-nums" : "library-card-media-chrome library-item-type-badge pointer-events-none absolute z-10 flex h-8 min-w-8 items-center justify-center gap-1.5 px-2 text-xs font-medium tabular-nums"} role="img" aria-label={label}>
    {variant === "card" ? count : null}<ItemTypeIcon item={item} className="size-4" />
  </span>;
}
