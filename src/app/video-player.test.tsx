import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { VideoPlayer } from "./video-player";

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, "paused", { configurable: true, value: false });
    fireEvent.play(this);
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, "paused", { configurable: true, value: true });
    fireEvent.pause(this);
  });
});

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

function mountPlayer(duration = 120) {
  render(<VideoPlayer src="blob:clip" title="A clip" onError={vi.fn()} />);
  const video = document.querySelector("video")!;
  Object.defineProperty(video, "duration", { configurable: true, value: duration });
  fireEvent.loadedMetadata(video);
  return video;
}

test("fades controls while playing and reveals them on interaction or pause", () => {
  vi.useFakeTimers();
  const video = mountPlayer();
  const player = screen.getByRole("region", { name: "Video player" });
  fireEvent.click(screen.getByRole("button", { name: "Play video" }));
  act(() => vi.advanceTimersByTime(1500));
  expect(player).toHaveAttribute("data-idle", "true");
  fireEvent.pointerMove(player);
  expect(player).toHaveAttribute("data-idle", "false");
  fireEvent.pointerLeave(player);
  act(() => vi.advanceTimersByTime(349));
  expect(player).toHaveAttribute("data-idle", "false");
  act(() => vi.advanceTimersByTime(1));
  expect(player).toHaveAttribute("data-idle", "true");
  fireEvent.pause(video);
  expect(player).toHaveAttribute("data-idle", "false");
});

test("tracks actual playback events, including ended, and handles rejected play", async () => {
  const video = mountPlayer();
  fireEvent.click(screen.getByRole("button", { name: "Play" }));
  await screen.findByRole("button", { name: "Pause" });
  expect(screen.queryByRole("button", { name: "Play video" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  expect(video.paused).toBe(true);
  fireEvent.play(video);
  fireEvent.ended(video);
  expect(screen.getByRole("button", { name: "Play video" })).toBeVisible();
  Object.defineProperty(video, "paused", { configurable: true, value: true });
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error("blocked"));
  fireEvent.click(screen.getByRole("button", { name: "Play" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Couldn't start playback");
});

test("clamps seeks, disables an unknown duration, and uses current media time for skips", () => {
  const video = mountPlayer(Infinity);
  const seek = screen.getByRole("slider", { name: "Seek video" });
  expect(seek).toBeDisabled();
  expect(screen.getByRole("button", { name: "Forward 10 seconds" })).toBeDisabled();
  Object.defineProperty(video, "duration", { configurable: true, value: 120 });
  fireEvent.durationChange(video);
  fireEvent.change(seek, { target: { value: "115" } });
  expect(video.currentTime).toBe(115);
  fireEvent.click(screen.getByRole("button", { name: "Forward 10 seconds" }));
  expect(video.currentTime).toBe(120);
  video.currentTime = 3;
  fireEvent.click(screen.getByRole("button", { name: "Rewind 10 seconds" }));
  expect(video.currentTime).toBe(0);
  video.currentTime = 35;
  fireEvent.timeUpdate(video);
  expect(seek).toHaveAttribute("aria-valuetext", "0:35 of 2:00");
});

test("updates actual media volume, mute and speed from controls and keyboard", async () => {
  const video = mountPlayer();
  fireEvent.change(screen.getByRole("slider", { name: "Volume" }), { target: { value: "0.4" } });
  expect(video.volume).toBe(0.4);
  fireEvent.volumeChange(video);
  fireEvent.click(screen.getByRole("button", { name: "Mute" }));
  expect(video.muted).toBe(true);
  fireEvent.volumeChange(video);
  fireEvent.click(screen.getByRole("button", { name: "Unmute" }));
  expect(video.muted).toBe(false);
  video.volume = 0; video.muted = false;
  fireEvent.volumeChange(video);
  fireEvent.click(screen.getByRole("button", { name: "Unmute" }));
  expect(video.volume).toBe(1);
  expect(video.muted).toBe(false);
  fireEvent.keyDown(screen.getByRole("region", { name: "Video player" }), { key: "ArrowDown" });
  expect(video.volume).toBe(0.9);
  fireEvent.click(screen.getByRole("button", { name: "Playback speed" }));
  fireEvent.click(await screen.findByRole("menuitemradio", { name: "1.5x" }));
  expect(video.playbackRate).toBe(1.5);
});

test("preserves range keyboard behavior and uses fullscreen events rather than optimistic state", async () => {
  const video = mountPlayer();
  video.currentTime = 20;
  const seek = screen.getByRole("slider", { name: "Seek video" });
  fireEvent.keyDown(seek, { key: "ArrowRight" });
  expect(video.currentTime).toBe(20);
  const player = screen.getByRole("region", { name: "Video player" });
  fireEvent.keyDown(player, { key: "ArrowRight" });
  expect(video.currentTime).toBe(30);
  const request = vi.fn().mockRejectedValueOnce(new Error("denied"));
  Object.defineProperty(player, "requestFullscreen", { configurable: true, value: request });
  fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Couldn't enter full screen"));
  expect(screen.queryByRole("button", { name: "Exit full screen" })).not.toBeInTheDocument();
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: player });
  fireEvent(document, new Event("fullscreenchange"));
  expect(screen.getByRole("button", { name: "Exit full screen" })).toBeVisible();
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
  fireEvent(document, new Event("fullscreenchange"));
  expect(screen.getByRole("button", { name: "Full screen" })).toBeVisible();
});
