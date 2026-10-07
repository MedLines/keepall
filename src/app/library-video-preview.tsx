"use client";

import { useEffect, useRef, useState } from "react";
import { getVideoBlob } from "@/persistence/videos";
import { putThumbnail } from "@/persistence/thumbnails";
import { snapshotVideoPoster, videoFrameHasContent, videoPreviewTimes } from "./prepare-local-video";
import { invalidateThumbnailObjectUrl } from "./asset-object-url-cache";

let activePreviewStop: (() => void) | null = null;
const refreshedPosters = new Set<string>();

type Session = { stop: () => void; seek: (video: HTMLVideoElement) => void; play: (video: HTMLVideoElement) => void; ready: (video: HTMLVideoElement) => void; advance: (video: HTMLVideoElement) => void };

export function LibraryVideoPreview({ assetId, active, onStop }: { assetId: string; active: boolean; onStop: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<Session | null>(null);
  const [source, setSource] = useState<{ assetId: string; url: string } | null>(null);
  const [readyUrl, setReadyUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!active || document.hidden || !window.matchMedia("(hover: hover) and (pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let live = true;
    let url: string | null = null;
    let sample = 0;
    let segmentEnd = 0;
    let limit: ReturnType<typeof setTimeout> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let posterTimer: ReturnType<typeof setTimeout> | undefined;
    let encodePoster: (() => Promise<Blob>) | undefined;
    let frameCallback: number | null = null;
    let revealed = false;
    const dispose = (notify: boolean) => {
      if (!live) return;
      live = false;
      clearTimeout(dwell); clearTimeout(timeout); clearTimeout(limit); clearTimeout(posterTimer);
      if (activePreviewStop === stop) activePreviewStop = null;
      const video = videoRef.current;
      if (video && frameCallback !== null) video.cancelVideoFrameCallback(frameCallback);
      encodePoster = undefined;
      sessionRef.current = null;
      if (video) { video.pause(); video.removeAttribute("src"); video.load(); }
      if (url) URL.revokeObjectURL(url);
      setSource(null);
      if (notify) onStop();
    };
    const stop = () => dispose(true);
    const visibilityChanged = () => { if (document.hidden) stop(); };
    const seek = (video: HTMLVideoElement) => {
      if (!live) return;
      if (!(Number.isFinite(video.duration) && video.duration > 0)) { stop(); return; }
      video.pause();
      const time = videoPreviewTimes(video.duration)[sample];
      segmentEnd = Math.min(video.duration, time + Math.min(1.4, video.duration * 0.15));
      video.currentTime = time;
    };
    const reveal = (video: HTMLVideoElement) => {
      if (!live || revealed) return;
      revealed = true;
      setReadyUrl(video.getAttribute("src"));
    };
    const play = (video: HTMLVideoElement) => {
      if (!live) return;
      const hasContent = video.videoWidth > 0 && video.videoHeight > 0 && videoFrameHasContent(video);
      if (!hasContent && video.videoWidth > 0 && sample < 2) { sample++; seek(video); return; }
      clearTimeout(timeout);
      if (!limit) limit = setTimeout(stop, 6000);
      if (!revealed && frameCallback === null && typeof video.requestVideoFrameCallback === "function") {
        frameCallback = video.requestVideoFrameCallback(() => { frameCallback = null; reveal(video); });
      }
      if (!refreshedPosters.has(assetId) && !encodePoster && !posterTimer && hasContent) {
        try { encodePoster = snapshotVideoPoster(video); }
        catch { /* A poster failure must not prevent playback. */ }
      }
      void video.play().then(() => {
        if (!live || posterTimer || !encodePoster) return;
        posterTimer = setTimeout(() => {
          const encode = encodePoster!;
          encodePoster = undefined;
          refreshedPosters.add(assetId);
          while (refreshedPosters.size > 64) refreshedPosters.delete(refreshedPosters.values().next().value!);
          void encode().then(async blob => {
            await putThumbnail(assetId, blob);
            invalidateThumbnailObjectUrl(assetId);
          }).catch(() => refreshedPosters.delete(assetId));
        }, 200);
      }).catch(stop);
    };
    sessionRef.current = { stop, seek, play, ready: video => {
      if (typeof video.requestVideoFrameCallback !== "function") reveal(video);
    }, advance: video => {
      if (live && !video.seeking && video.currentTime >= segmentEnd) { sample = (sample + 1) % 3; seek(video); }
    } };
    const dwell = setTimeout(() => {
      activePreviewStop?.();
      activePreviewStop = stop;
      timeout = setTimeout(stop, 8000);
      void getVideoBlob(assetId).then(blob => {
        if (!live) return;
        if (!blob) { stop(); return; }
        url = URL.createObjectURL(blob);
        setSource({ assetId, url });
      }).catch(stop);
    }, 150);
    window.addEventListener("scroll", stop, { capture: true, passive: true });
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      dispose(false);
      window.removeEventListener("scroll", stop, true);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [active, assetId, onStop]);

  if (!active || source?.assetId !== assetId) return null;
  return <video ref={videoRef} src={source.url} muted playsInline preload="auto" aria-hidden="true" tabIndex={-1}
    data-video-preview={readyUrl === source.url ? "playing" : "loading"}
    className={`library-video-preview media-squircle-inset pointer-events-none absolute inset-0 size-full object-cover ${readyUrl === source.url ? "opacity-100" : "opacity-0"}`}
    onLoadedMetadata={event => sessionRef.current?.seek(event.currentTarget)}
    onSeeked={event => sessionRef.current?.play(event.currentTarget)}
    onPlaying={event => sessionRef.current?.ready(event.currentTarget)}
    onTimeUpdate={event => sessionRef.current?.advance(event.currentTarget)}
    onError={() => sessionRef.current?.stop()} />;
}
