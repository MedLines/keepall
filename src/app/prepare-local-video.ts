import { assertLocalVideo, VideoValidationError } from "@/domain/video";

export function videoFrameHasContent(video: HTMLVideoElement): boolean {
  const canvas = document.createElement("canvas");
  canvas.width = 12; canvas.height = 12;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return false;
  context.drawImage(video, 0, 0, 12, 12);
  const pixels = context.getImageData(0, 0, 12, 12).data;
  let visible = 0;
  for (let index = 0; index < pixels.length; index += 4) if (Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) > 20) visible++;
  return visible >= 6;
}

export function videoPreviewTimes(duration: number): readonly number[] {
  return [Math.min(5, duration * 0.12), duration * 0.42, duration * 0.72];
}

/** Freeze the starting frame now; encode it after playback starts. */
export function snapshotVideoPoster(video: HTMLVideoElement): () => Promise<Blob> {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new VideoValidationError("Couldn't create a video poster");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return () => new Promise<Blob>((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new VideoValidationError("Couldn't create a video poster")), "image/webp", 0.8,
  ));
}

export async function captureVideoPoster(video: HTMLVideoElement): Promise<Blob> {
  return snapshotVideoPoster(video)();
}

/** Decode a frame beyond the opening, rather than saving a blank first frame. */
export async function prepareLocalVideo(file: File): Promise<Blob> {
  assertLocalVideo(file);
  const video = document.createElement("video");
  if (!video.canPlayType(file.type)) {
    throw new VideoValidationError("This browser cannot play that video format");
  }
  const url = URL.createObjectURL(file);
  video.preload = "auto";
  video.muted = true;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new VideoValidationError("Couldn't read this video")), 12_000);
      video.onloadeddata = () => { window.clearTimeout(timer); resolve(); };
      video.onerror = () => { window.clearTimeout(timer); reject(new VideoValidationError("This browser cannot play this video")); };
      video.src = url;
      video.load();
    });
    if (!video.videoWidth || !video.videoHeight) {
      throw new VideoValidationError("This browser cannot read this video");
    }
    if (Number.isFinite(video.duration) && video.duration > 0.1) {
      for (const time of videoPreviewTimes(video.duration)) {
        await new Promise<void>(resolve => {
          const timer = window.setTimeout(resolve, 1500);
          video.onseeked = () => { window.clearTimeout(timer); resolve(); };
          video.currentTime = time;
        });
        if (videoFrameHasContent(video)) break;
      }
    }
    return await captureVideoPoster(video);
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
