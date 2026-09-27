"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FullScreenIcon, PauseIcon, PlayIcon } from "../shell-icons";

export function RecordedDemo({ active, name, src, poster }: { active: boolean; name: string; src: string; poster: ReactNode }) {
  const video = useRef<HTMLVideoElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused" | "ended">("idle");
  const [error, setError] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const [progress, setProgress] = useState({ value: 0, reset: false });
  const playing = state === "playing";

  useEffect(() => {
    const element = video.current;
    const frame = container.current;
    if (!element || !frame) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const syncPlayback = () => {
      if (!active || !visible || document.hidden) {
        element.pause();
        return;
      }
      if (preference.matches) return;
      element.currentTime = 0;
      void element.play().catch(() => {
        // Autoplay can be blocked by browser settings; the play control stays available.
      });
    };
    const onMotionPreferenceChange = () => {
      if (preference.matches) element.pause();
      else syncPlayback();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= .35;
      void syncPlayback();
    }, { threshold: .35 });
    observer.observe(frame);
    document.addEventListener("visibilitychange", syncPlayback);
    preference.addEventListener("change", onMotionPreferenceChange);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
      preference.removeEventListener("change", onMotionPreferenceChange);
      element.pause();
    };
  }, [active]);

  async function togglePlayback() {
    const element = video.current;
    if (!element || state === "loading") return;
    if (playing) {
      element.pause();
      return;
    }
    setError(false);
    setState("loading");
    if (element.ended) element.currentTime = 0;
    try {
      await element.play();
      // A different gallery view may have been selected while the clip loaded.
      if (element.closest("[inert]")) element.pause();
    } catch {
      setState("idle");
      setError(true);
    }
  }

  const action = playing ? "Pause" : state === "ended" ? "Replay" : state === "paused" ? "Resume" : "Play";
  return <div ref={container} className="ka-recording" data-playing={playing}>
    {poster}
    <video ref={video} className="ka-recording-video" style={{ opacity: hasFrame ? 1 : 0 }} width={1440} height={860} preload="none" muted playsInline loop aria-label={`${name} demonstration recorded in Keepall`} onLoadedData={() => setHasFrame(true)} onPlaying={() => setState("playing")} onPause={() => { if (!video.current?.ended) setState("paused"); }} onEnded={() => setState("ended")} onTimeUpdate={() => {
      const element = video.current;
      if (element?.duration) {
        const value = element.currentTime / element.duration;
        setProgress(previous => ({ value, reset: value < previous.value }));
      }
    }}>
      <source src={`${src}.webm`} type="video/webm" />
      <source src={`${src}.mp4`} type="video/mp4" />
    </video>
    <div className="ka-recording-controls">
      <button type="button" className="ui-control ui-primary squircle-panel" onClick={togglePlayback} aria-busy={state === "loading"} aria-label={`${action} ${name} demo`}>
        {playing ? <PauseIcon /> : <PlayIcon />}
        {state === "loading" ? "Loading…" : `${action} demo`}
      </button>
      <span className="ka-recording-caption">{error ? "Couldn’t load. Try again." : "Recorded in Keepall"}</span>
      <a className="ka-recording-expand ui-control squircle-panel" href={`${src}.mp4`} target="_blank" rel="noreferrer" aria-label={`Open ${name} demo full size`} onClick={() => video.current?.pause()}><FullScreenIcon /></a>
    </div>
    <div className="ka-recording-progress" aria-hidden="true"><span style={{ transform: `scaleX(${progress.value})`, transitionDuration: progress.reset ? "0ms" : undefined }} /></div>
  </div>;
}
