export const MAX_LOCAL_VIDEO_BYTES = 100 * 1024 * 1024;
const VIDEO_MIMES = new Set(["video/mp4", "video/webm"]);

export type VideoItem = {
  id: string;
  type: "video";
  title: string;
  noteContent: string;
  noteFormat?: "markdown";
  sourceFileName: string;
  assetId: string;
  tagIds: string[];
  collectionIds: string[];
  createdAt: number;
  updatedAt: number;
};

export class VideoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoValidationError";
  }
}

export function assertLocalVideo(file: Pick<Blob, "size" | "type">): void {
  if (!VIDEO_MIMES.has(file.type.toLowerCase())) {
    throw new VideoValidationError("Use an MP4 or WebM video");
  }
  if (file.size === 0) throw new VideoValidationError("Video file is empty");
  if (file.size > MAX_LOCAL_VIDEO_BYTES) {
    throw new VideoValidationError("Video must be 100 MiB or smaller");
  }
}

export function buildVideo(input: { assetId: string; fileName: string; title?: string; noteContent?: string; noteFormat?: "plain" | "markdown" }, options?: { id?: string; now?: number }): VideoItem {
  const now = options?.now ?? Date.now();
  const title = input.title?.trim() || input.fileName.replace(/\.[^.]+$/, "").trim() || "Video";
  return {
    id: options?.id ?? crypto.randomUUID(), type: "video", title,
    sourceFileName: input.fileName, assetId: input.assetId,
    noteContent: input.noteContent?.trim() ?? "",
    ...(input.noteFormat === "markdown" ? { noteFormat: "markdown" as const } : {}),
    tagIds: [], collectionIds: [], createdAt: now, updatedAt: now,
  };
}
