import { assertLocalVideo, VideoValidationError } from "@/domain/video";

/** Verify the browser can open the chosen file and capture its first decoded frame. */
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
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new VideoValidationError("Couldn't create a video poster");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new VideoValidationError("Couldn't create a video poster")),
      "image/webp", 0.75,
    ));
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
