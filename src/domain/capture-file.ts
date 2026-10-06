import { isAllowedLocalImageMime } from "./image";

const MEDIA_MIMES: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", avif: "image/avif", mp4: "video/mp4", webm: "video/webm",
};

export const CAPTURE_FILE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp,image/avif,video/mp4,video/webm,.txt,.md,.pdf";

export function classifyCaptureFile(file: Pick<File, "name" | "type">): {
  kind: "image" | "video" | "document" | "unsupported"; mimeType: string;
} {
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  if (file.name.includes(".") && (extension === "txt" || extension === "md" || extension === "pdf")) {
    return { kind: "document", mimeType: extension === "pdf" ? "application/pdf" : extension === "md" ? "text/markdown" : "text/plain" };
  }
  const mimeType = file.type && file.type !== "application/octet-stream"
    ? file.type.split(";")[0].trim().toLowerCase() : MEDIA_MIMES[extension] ?? "";
  if (isAllowedLocalImageMime(mimeType)) return { kind: "image", mimeType };
  if (mimeType === "video/mp4" || mimeType === "video/webm") return { kind: "video", mimeType };
  return { kind: "unsupported", mimeType };
}
