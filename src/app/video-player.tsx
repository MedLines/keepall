"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Menu } from "@base-ui/react/menu";
import { CheckIcon, ChevronDownIcon, ExitFullScreenIcon, ForwardIcon, FullScreenIcon, MuteIcon, PauseIcon, PlayIcon, RewindIcon, VolumeIcon } from "./shell-icons";
import styles from "./video-player.module.css";

function formatTime(value: number) {
  const seconds = Math.floor(Number.isFinite(value) ? Math.max(0, value) : 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}` : `${minutes}:${remainder}`;
}

function PlayerControl({ label, children, onClick, disabled = false, className = "" }: { label: string; children: ReactNode; onClick: () => void; disabled?: boolean; className?: string }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
    className={`${styles.control} ${className}`}>{children}</button>;
}

function rangeStyle(value: number, max: number): CSSProperties {
  return { "--range-progress": `${max > 0 ? (value / max) * 100 : 0}%` } as CSSProperties;
}

export function VideoPlayer({ src, poster, title, onError }: { src: string; poster?: string; title: string; onError: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedMenuOpenRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [idle, setIdle] = useState(false);
  const hasDuration = duration > 0;

  const scheduleHide = (delay: number) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!videoRef.current?.paused) {
      hideTimerRef.current = setTimeout(() => {
        const player = playerRef.current;
        if (!speedMenuOpenRef.current && !player?.matches(":focus-visible") && !player?.querySelector(":focus-visible") && !player?.querySelector('[aria-label="Playback controls"]:hover')) setIdle(true);
      }, delay);
    }
  };
  const revealControls = () => { setIdle(false); scheduleHide(1500); };

  useEffect(() => () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); }, []);

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === playerRef.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;
    setMessage(null);
    if (!video.paused) { video.pause(); return; }
    try { await video.play(); }
    catch { setMessage("Couldn't start playback. Try Play again."); }
  };
  const seek = (value: number) => {
    const video = videoRef.current;
    if (!video || !hasDuration) return;
    video.currentTime = Math.max(0, Math.min(duration, value));
    setCurrentTime(video.currentTime);
  };
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const silent = video.muted || video.volume === 0;
    if (video.volume === 0) video.volume = 1;
    video.muted = !silent;
  };
  const changeVolume = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.max(0, Math.min(1, value));
    video.muted = value === 0;
  };
  const toggleFullscreen = async () => {
    setMessage(null);
    try {
      if (document.fullscreenElement === playerRef.current) await document.exitFullscreen();
      else await playerRef.current?.requestFullscreen();
    } catch { setMessage("Couldn't enter full screen in this browser."); }
  };
  const updateDuration = () => {
    const value = videoRef.current?.duration ?? 0;
    setDuration(Number.isFinite(value) ? value : 0);
  };

  return <div ref={playerRef} className={styles.player} role="region" aria-label="Video player" tabIndex={0}
    data-idle={idle && playing} onPointerMove={revealControls} onPointerDown={revealControls} onFocusCapture={revealControls}
    onPointerLeave={() => scheduleHide(350)} onBlurCapture={() => scheduleHide(350)}
    onKeyDown={event => {
      if (event.target instanceof Element && event.target.closest('[role="menu"]')) return;
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      const key = event.key.toLowerCase();
      const actions: Record<string, () => void> = {
        k: () => void togglePlay(), m: toggleMute, f: () => void toggleFullscreen(),
        arrowleft: () => seek((videoRef.current?.currentTime ?? 0) - 10),
        arrowright: () => seek((videoRef.current?.currentTime ?? 0) + 10),
        arrowup: () => changeVolume((videoRef.current?.volume ?? 1) + 0.1),
        arrowdown: () => changeVolume((videoRef.current?.volume ?? 1) - 0.1),
      };
      if (event.target === event.currentTarget && key === " ") actions[key] = () => void togglePlay();
      if (actions[key]) { event.preventDefault(); event.stopPropagation(); actions[key](); }
    }}>
    <div className={styles.stage}>
      <video ref={videoRef} src={src} poster={poster} aria-label={title} preload="metadata" playsInline
        className={styles.video} onError={onError} onLoadedMetadata={updateDuration} onDurationChange={updateDuration}
        onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => { setPlaying(true); revealControls(); }}
        onPause={() => { setPlaying(false); revealControls(); }} onEnded={() => { setPlaying(false); revealControls(); }}
        onRateChange={event => setRate(event.currentTarget.playbackRate)}
        onVolumeChange={event => { setVolume(event.currentTarget.volume); setMuted(event.currentTarget.muted); }} />
      <button type="button" className={styles.playSurface} aria-label={playing ? "Pause video" : "Play video"} onClick={() => void togglePlay()}>
        <span className={styles.playOverlay} data-playing={playing}>
          {playing ? <PauseIcon className="size-6" fill="currentColor" /> : <PlayIcon className="size-6 translate-x-0.5" fill="currentColor" />}
        </span>
      </button>
    <div className={styles.controls} role="group" aria-label="Playback controls">
      <div className="flex items-center gap-3">
        <span className="min-w-10 text-xs tabular-nums">{formatTime(currentTime)}</span>
        <input type="range" aria-label="Seek video" aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          min={0} max={hasDuration ? duration : 1} step={0.1} value={Math.min(currentTime, duration)} disabled={!hasDuration}
          className={`${styles.range} min-w-0 flex-1`} style={rangeStyle(currentTime, duration)}
          onChange={event => seek(Number(event.target.value))} />
        <span className="min-w-10 text-right text-xs tabular-nums">{formatTime(duration)}</span>
      </div>
      <div className="mt-2 flex items-center gap-1 sm:gap-2">
        <PlayerControl label="Rewind 10 seconds" className={styles.skip} disabled={!hasDuration} onClick={() => seek((videoRef.current?.currentTime ?? 0) - 10)}><RewindIcon /></PlayerControl>
        <PlayerControl label={playing ? "Pause" : "Play"} onClick={() => void togglePlay()}>{playing ? <PauseIcon /> : <PlayIcon />}</PlayerControl>
        <PlayerControl label="Forward 10 seconds" className={styles.skip} disabled={!hasDuration} onClick={() => seek((videoRef.current?.currentTime ?? 0) + 10)}><ForwardIcon /></PlayerControl>
        <div className={styles.volume}>
          <PlayerControl label={muted || volume === 0 ? "Unmute" : "Mute"} onClick={toggleMute}>{muted || volume === 0 ? <MuteIcon /> : <VolumeIcon />}</PlayerControl>
          <div className={styles.volumeSlider}>
            <input type="range" aria-label="Volume" min={0} max={1} step={0.05} value={muted ? 0 : volume}
              className={styles.range} style={rangeStyle(muted ? 0 : volume, 1)}
              onChange={event => changeVolume(Number(event.target.value))} />
          </div>
        </div>
        <Menu.Root modal={false} onOpenChange={open => { speedMenuOpenRef.current = open; revealControls(); }}>
          <Menu.Trigger aria-label="Playback speed" title="Playback speed" className={styles.speed}>
            <span>{rate}x</span><ChevronDownIcon className="size-3.5" />
          </Menu.Trigger>
          <Menu.Portal container={playerRef}>
            <Menu.Positioner side="top" align="end" sideOffset={8} collisionPadding={8} className="z-[60]">
              <Menu.Popup aria-label="Playback speed" className="ui-menu-popup ui-popover w-40 p-1 outline-none">
                <p className="px-3 py-2 text-xs text-text-secondary">Playback speed</p>
                <Menu.RadioGroup value={String(rate)} onValueChange={value => { if (videoRef.current) videoRef.current.playbackRate = Number(value); }}>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map(value => <Menu.RadioItem key={value} value={String(value)} closeOnClick
                    className="ui-menu-item flex w-full items-center justify-between px-3 text-sm tabular-nums text-text-primary outline-none data-[highlighted]:bg-bg-active">
                    <span>{value}x</span><Menu.RadioItemIndicator><CheckIcon className="size-4" /></Menu.RadioItemIndicator>
                  </Menu.RadioItem>)}
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
        <PlayerControl label={fullscreen ? "Exit full screen" : "Full screen"} onClick={() => void toggleFullscreen()}>{fullscreen ? <ExitFullScreenIcon /> : <FullScreenIcon />}</PlayerControl>
      </div>
      {message ? <p role="status" className="mt-2 text-xs">{message}</p> : null}
    </div>
    </div>
  </div>;
}
